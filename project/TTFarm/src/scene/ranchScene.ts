import * as THREE from "three";
import { isMountAnimal, MOUNT_UNLOCK_LEVEL, wildAnimalsAt, WILD_CLEARINGS, type AnimalElement, type RanchAnimal, type RanchState, type WildAnimal } from "../game/ranch";
import { setNearbyAnimal, setNearRanch } from "../game/ranchInteraction";
import { createAnimalLibrary, saddleHeight } from "./ranchAnimals";
import { createRanchAuras } from "./ranchAuras";
import { buildRanchPen } from "./ranchPen";
import { onRanchReserve, RANCH_ENTRANCE } from "./ranchLayout";
import { FENCE_X, FENCE_Z, RIVER_BED, riverInfo } from "./layout";
import type { WorldObstacles } from "./obstacles";

function hash(key:string) {
  let n=2166136261;
  for(const char of key)n=Math.imul(n^char.charCodeAt(0),16777619);
  return (n>>>0)/4294967296;
}
function spawnAt(animal:WildAnimal, obstacles:WorldObstacles) {
  const rotation = Number(animal.id.split("-")[1]) || 0;
  const index = (animal.slot + rotation * 7) % WILD_CLEARINGS.length;
  const [cx,cz]=WILD_CLEARINGS[index];
  const phase=hash(animal.id)*Math.PI*2;
  for(let i=0;i<55;i++){
    const a=phase+i*2.40,r=Math.sqrt(i)*(animal.slot<2?.50:1.08)+.7;
    const p=new THREE.Vector3(cx+r*Math.cos(a),0,cz+r*Math.sin(a));
    if(Math.abs(p.x)<FENCE_X+1.7 && Math.abs(p.z)<FENCE_Z+1.7 || onRanchReserve(p.x,p.z,1.8)
      || riverInfo(p.x,p.z).dist<RIVER_BED.shoulder+2)continue;
    if([0,1,2,3,4,5,6,7].every(k=>obstacles.canWalk(p,{x:p.x+1.4*Math.cos(k*Math.PI/4),z:p.z+1.4*Math.sin(k*Math.PI/4)})))return p;
  }
  return obstacles.project({x:cx,z:cz});
}
type Library = ReturnType<typeof createAnimalLibrary>;
interface Actor {
  animal:RanchAnimal;
  wild:WildAnimal|null;
  ridden:boolean;
  rig:ReturnType<Library["create"]>;
  anchor:THREE.Vector3;
  seed:number;
  phase:number;
  range:number;
  wanderLeg:number;
  wanderTarget:THREE.Vector3;
}

export function createRanchScene(obstacles:WorldObstacles) {
  const group=new THREE.Group(); group.name="ranch-and-wildlife";
  const library=createAnimalLibrary(), auras=createRanchAuras();
  group.add(auras.mesh);
  let pen:ReturnType<typeof buildRanchPen>|null=null;
  let lastRanch:RanchState|null=null, lastHerd:readonly WildAnimal[]|null=null;
  type Rider = "local" | "peer" | "stable";
  let lastRider:Rider|null=null;
  const actors=new Map<string,Actor>();
  const bursts:Array<{at:THREE.Vector3;time:number;element:AnimalElement|null}>=[];
  const playerPosition=new THREE.Vector3();
  const hit=new THREE.Vector3(), bound=new THREE.Sphere();
  const tau=Math.PI*2;

  function sync(now:number,t:number,ranch:RanchState,rider:Rider){
    const herd=wildAnimalsAt(now);
    if(ranch===lastRanch && herd===lastHerd && rider===lastRider)return;
    if(!pen || ranch.level!==lastRanch?.level) {
      if(pen){group.remove(pen.group);pen.dispose();}
      pen=buildRanchPen(ranch.level,obstacles);group.add(pen.group);
    }
    const {west,east,north,south}=pen.bounds;
    const divided=ranch.level>=MOUNT_UNLOCK_LEVEL;
    const wanted=new Set<string>();
    function place(animal:RanchAnimal,wild:WildAnimal|null,ridden:boolean,location:()=>THREE.Vector3,range:number) {
      wanted.add(animal.id);
      let actor=actors.get(animal.id);
      if(actor && (actor.ridden!==ridden || actor.animal.element!==animal.element || actor.animal.species!==animal.species)) {
        group.remove(actor.rig.group);actor.rig.dispose();actors.delete(animal.id);actor=undefined;
      }
      if(!actor){
        const seed=hash(animal.id);
        actor={animal,wild,ridden,anchor:location(),range,seed,phase:tau*seed,wanderLeg:-1,wanderTarget:location(),rig:library.create(animal.species,animal.element,ridden)};
        actor.rig.group.name=(wild?"wild-":"ranch-")+animal.species;
        actor.rig.group.userData.animalId=animal.id;
        actor.rig.group.position.copy(actor.anchor);
        actor.rig.group.rotation.y=seed*tau;
        actors.set(animal.id,actor);group.add(actor.rig.group);
      } else if(!wild){
        const anchor=location();
        if(actor.wild){
          bursts.push({at:actor.rig.group.position.clone(),time:t,element:animal.element},
            {at:anchor.clone(),time:t,element:animal.element});
        }
        // 野外收服/放归时直接切换所在地，避免动物从原野点一路“滑步”走向牧场。
        actor.rig.group.position.copy(anchor);
        actor.anchor.copy(anchor);
        actor.range=range;
        actor.wanderLeg=-1;
        actor.wanderTarget.copy(anchor);
      } else if(!actor.wild){
        const anchor=location();
        actor.rig.group.position.copy(anchor);
        actor.anchor.copy(anchor);actor.range=range;
        actor.wanderLeg=-1;
        actor.wanderTarget.copy(anchor);
      }
      actor.wild=wild;
      actor.rig.group.name=(wild?"wild-":ridden?"ridden-":"ranch-")+animal.species;
    }
    function populate(animals:RanchAnimal[],left:number,right:number) {
      const count=animals.length;
      if(!count)return;
      const dx=right-left, dz=south-north;
      const cols=Math.min(count,Math.max(1,Math.round(Math.sqrt(count*dx/dz))));
      const rows=Math.ceil(count/cols);
      for(let i=0;i<count;i++) {
        const row=Math.floor(i/cols), col=i%cols;
        const inRow=Math.min(cols,count-row*cols);
        const x=left+(col+.5)*dx/inRow;
        const z=north+1.05+(row+.5)*(dz-1.65)/rows;
        const range=Math.max(.08,Math.min(.42,(dx/inRow-1.60)*.24,((dz-1.65)/rows-1.95)*.22));
        place(animals[i],null,false,()=>new THREE.Vector3(x,.032,z),range);
      }
    }
    const atHome=rider==="stable"?ranch.animals:ranch.animals.filter(animal=>animal.id!==ranch.ridingId);
    const split=pen.divider;
    if(divided){
      populate(atHome.filter(isMountAnimal),west+.20,split-.20);
      populate(atHome.filter(animal=>!isMountAnimal(animal)),split+.20,east-.20);
    } else populate(atHome,west+.25,east-.25);
    const ridden=ranch.animals.find(animal=>animal.id===ranch.ridingId);
    if(ridden && rider==="local")place(ridden,null,true,()=>playerPosition.clone(),0);
    for(const animal of herd){
      if(!wanted.has(animal.id) && animal.id!==ridden?.id)place(animal,animal,false,()=>spawnAt(animal,obstacles),.82);
    }
    for(const [id,actor] of actors)if(!wanted.has(id)){
      group.remove(actor.rig.group);actor.rig.dispose();actors.delete(id);
    }
    lastRanch=ranch;lastHerd=herd;lastRider=rider;
  }

  function nearestWildPoint(){
    let best=Infinity, found:Actor|undefined;
    for(const actor of actors.values())if(actor.wild){
      const distance=actor.rig.group.position.distanceToSquared(playerPosition);
      if(distance<best){best=distance;found=actor;}
    }
    return found?.rig.group.position.clone()??null;
  }
  function pickWild(raycaster:THREE.Raycaster) {
    let best=Infinity,found:Actor|undefined;
    for(const actor of actors.values())if(actor.wild){
      const p=actor.rig.group.position, h=saddleHeight(actor.animal.species);
      bound.center.copy(p);bound.center.y+=h*.64;
      bound.radius=.18+h*.66;
      if(raycaster.ray.intersectSphere(bound,hit)){
        const dist=hit.distanceToSquared(raycaster.ray.origin);
        if(dist<best){best=dist;found=actor;}
      }
    }
    return found?.rig.group.position.clone()??null;
  }
  function update(t:number,dt:number,now:number,ranch:RanchState,playerRoot:THREE.Object3D,moving:boolean,
                  rider:Rider="local", spectatorFocus?:THREE.Vector3,
                  emitPeerAuras?:(auras:ReturnType<typeof createRanchAuras>,time:number)=>void, running=false) {
    playerPosition.copy(spectatorFocus ?? playerRoot.position);
    sync(now,t,ranch,rider);
    auras.begin();
    let closest:WildAnimal|null=null,closestDist=3.35**2;
    for(const actor of actors.values()) {
      const model=actor.rig.group,p=model.position, h=saddleHeight(actor.animal.species);
      let stride=0;
      if(actor.ridden){
        p.copy(playerRoot.position);model.rotation.y=playerRoot.rotation.y;
        stride=moving?(running?1:.54):0;
      } else {
        // 随机漫游：落点始终限制在 anchor + range 内，走到后立刻选下一个点；
        // 不再沿固定八字循环，也不会长期站在同一处。
        const leg = Math.floor(t / (5.2 + actor.seed * 2.8));
        const travelNow = Math.hypot(actor.wanderTarget.x - p.x, actor.wanderTarget.z - p.z);
        if (leg > actor.wanderLeg || travelNow <= 0.045) {
          actor.wanderLeg = Math.max(actor.wanderLeg + 1, leg);
          const a = hash(actor.animal.id + ":" + actor.wanderLeg) * tau;
          const r = actor.wild
            ? actor.range * (0.35 + hash(actor.animal.id + ":r:" + actor.wanderLeg) * 0.65)
            : Math.max(actor.range, 0.36) * (0.45 + hash(actor.animal.id + ":r:" + actor.wanderLeg) * 0.55);
          actor.wanderTarget.set(actor.anchor.x + Math.cos(a) * r, actor.anchor.y, actor.anchor.z + Math.sin(a) * r);
          const shore = riverInfo(actor.wanderTarget.x, actor.wanderTarget.z);
          if (shore.dist < RIVER_BED.waterLine + 1.35) {
            const push = RIVER_BED.waterLine + 1.35 - shore.dist;
            actor.wanderTarget.x += shore.nx * push;
            actor.wanderTarget.z += shore.nz * push;
          }
          if (!obstacles.canWalk(p, actor.wanderTarget)) actor.wanderTarget.copy(actor.anchor);
        }
        let strideNow = 0;
        const travel = Math.hypot(actor.wanderTarget.x - p.x, actor.wanderTarget.z - p.z);
        if (travel > 0.045) {
          const speed = actor.wild ? 1.08 : 0.62;
          const stepMotion = Math.min(travel, speed * dt);
          const nx = p.x + (actor.wanderTarget.x - p.x) / travel * stepMotion;
          const nz = p.z + (actor.wanderTarget.z - p.z) / travel * stepMotion;
          p.set(nx, actor.anchor.y, nz);
          strideNow = dt > 0 ? Math.min(.62, stepMotion / dt * 2.45) : 0;
          const yaw = Math.atan2(nx - actor.wanderTarget.x + 0.0001, nz - actor.wanderTarget.z + 0.0001) + Math.PI;
          const diff = THREE.MathUtils.euclideanModulo(yaw - model.rotation.y + Math.PI, tau) - Math.PI;
          model.rotation.y += diff * (1 - Math.exp(-dt * 4));
        }
        stride = strideNow;
      }
      const d=p.distanceToSquared(playerPosition);
      if(!spectatorFocus && actor.wild && d<closestDist && obstacles.canWalk(playerPosition,p)){
        closestDist=d;closest=actor.wild;
      }
      if(d<70**2 || actor.ridden){
        actor.phase+=dt*stride*(actor.ridden?8.2:5.5);
        actor.rig.animate(t+actor.seed*8,actor.phase,stride,d);
        if(actor.animal.element)auras.animal(p,h,actor.animal.element,t,actor.seed*tau);
      }
    }
    for(let i=bursts.length-1;i>=0;i--){
      const burst=bursts[i], progress=(t-burst.time)/1.25;
      if(progress>=1){bursts.splice(i,1);continue;}
      auras.burst(burst.at,progress,burst.element);
    }
    emitPeerAuras?.(auras,t);
    auras.end();
    setNearbyAnimal(closest);
    const {west,east,north,south}=pen!.bounds;
    const {x,z}=playerPosition;
    setNearRanch(!spectatorFocus && (x>=west && x<=east && z>=north && z<=south ||
      Math.hypot(x-RANCH_ENTRANCE.x,z-RANCH_ENTRANCE.z)<3.25));
  }
  return {group,update,pickWild,nearestWildPoint,animalLibrary:library,
    seatHeight(id:string){const actor=actors.get(id);return actor?.ridden?actor.rig.seatHeight:undefined;},
    dispose(){
    setNearbyAnimal(null);setNearRanch(false);
    actors.forEach(actor=>actor.rig.dispose());actors.clear();
    pen?.dispose();auras.dispose();library.dispose();
    group.clear();
  }};
}
