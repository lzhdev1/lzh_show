import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { elementPaint, saddleHeight } from "./ranchSpecies";
import { createMountRegalia } from "./mountRegalia";
import { makeElementInsignia } from "./elementInsignia";
import type { AnimalElement, AnimalSpecies } from "../game/ranch";

// The original armatures keep their authored joint axes. Only the outer mount
// node is normalized to farm coordinates (+Y up, +Z forward, metres).
const anatomy = {
  wolf: ["Head", "Bone005"], bear:["Ursidae_Head","Ursidae_Spine_2"], panda:["Ursidae_Head","Ursidae_Spine_2"],
  tiger:["head","spine2"], lion:["Horse_Head","Horse_Spine1"],
  elephant:["Elephantidae_Head","Elephantidae_Vertebrae_Dorsal"], fox:["Fox_head","Fox_spine2"],
  deer:["Deer01_Head","Deer01_Spine1"], rabbit:["Deer01_Head","Deer01_Spine1"],
  boar:["Boar_Head","Boar_Spine"], goat:["head","spine"], sheep:["Head","Spine"],
  horse:["Horse_Head","Horse_Spine_2"], cow:["Bovidae_Head","Bovidae_spine1"],
} as const;
type Species = keyof typeof anatomy;
export const isProfessionalSpecies = (species: AnimalSpecies): species is Species => Object.prototype.hasOwnProperty.call(anatomy,species);
const files = import.meta.glob("./professionalModels/*.glb", {eager:true,query:"?url",import:"default"}) as Record<string,string>;
const loader = new GLTFLoader();

function skinnedMeshes(model: THREE.Object3D) {
  const meshes: THREE.SkinnedMesh[] = [];
  model.traverse(o => { if (o instanceof THREE.SkinnedMesh) meshes.push(o); });
  return meshes;
}
function sampleNeutral(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const mixer = new THREE.AnimationMixer(root);
  const idle = THREE.AnimationClip.findByName(clips,"idle");
  if (idle) { mixer.clipAction(idle).play(); mixer.update(.015); }
  return mixer;
}
function releaseGltf(gltf:GLTF) {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  gltf.scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    geometry.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
    m.dispose();
  }
  for (const t of textures) { t.dispose(); if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap) t.image.close(); }
  for (const g of geometry) g.dispose();
}

interface SkinCloud {vertices:THREE.Vector3[];mesh:THREE.SkinnedMesh}
function findSeat(clouds:SkinCloud[], x:number, z:number) {
  let seat:{mesh:number;ids:number[];weights:number[];height:number}|undefined;
  clouds.forEach(({mesh,vertices},part)=>{
    const index=mesh.geometry.index;
    const count=index?.count??vertices.length;
    for (let i=0;i<count;i+=3) {
      const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
      const a=vertices[ia],b=vertices[ib],c=vertices[ic];
      const bx=b.x-a.x,bz=b.z-a.z,cx=c.x-a.x,cz=c.z-a.z,det=bx*cz-bz*cx;
      if (Math.abs(det)<1e-10) continue;
      const u=((x-a.x)*cz-(z-a.z)*cx)/det,v=(bx*(z-a.z)-bz*(x-a.x))/det,w=1-u-v;
      if (u<0||v<0||w<0) continue;
      const height=w*a.y+u*b.y+v*c.y;
      if (!seat||height>seat.height) seat={mesh:part,ids:[ia,ib,ic],weights:[w,u,v],height};
    }
  });
  return seat;
}

function prepare(species: Species, gltf: GLTF) {
  const root = new THREE.Group();
  root.add(gltf.scene);
  const mixer = sampleNeutral(gltf.scene,gltf.animations);
  root.updateMatrixWorld(true);
  const point = new THREE.Vector3(), bounds = new THREE.Box3();
  const clouds = skinnedMeshes(root).map(mesh => {
    const vertices:THREE.Vector3[] = [];
    for (let i=0;i<mesh.geometry.attributes.position.count;i++) {
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      vertices.push(point.clone()); bounds.expandByPoint(point);
    }
    return { vertices, mesh };
  });
  const midX = (bounds.min.x+bounds.max.x)/2, midZ = 0;
  const width = bounds.max.x-bounds.min.x;
  const seat=findSeat(clouds,midX,midZ);
  const back=seat?.height??bounds.min.y+(bounds.max.y-bounds.min.y)*.72;
  const shoulderHeight = back-bounds.min.y;
  const height=saddleHeight(species), padding=height*.016, scale=(height-padding)/shoulderHeight;
  for (const {vertices,mesh} of clouds) {
    const flank=new Float32Array(vertices.length*3);
    vertices.forEach((p,i)=>{
      flank[i*3]=.5-(p.z-midZ)/(shoulderHeight*1.25);
      flank[i*3+1]=.5+(p.y-back+shoulderHeight*.24)/(shoulderHeight*.49);
      flank[i*3+2]=THREE.MathUtils.smoothstep(Math.abs(p.x-midX)/width,.13,.35);
    });
    mesh.geometry.setAttribute("flank",new THREE.BufferAttribute(flank,3));
  }
  // Keep the convex extremes of each toe, heel and ankle. A paw rolls from heel
  // to toe during a stride, so its lowest vertex can differ from the idle pose.
  const feet = clouds.map(({vertices,mesh}) => {
    const influence=mesh.geometry.getAttribute("skinWeight"), joints=mesh.geometry.getAttribute("skinIndex");
    const hulls = new Map<number,{id:number;projection:number}[]>();
    const directions:THREE.Vector3[]=[];
    for (const y of [-1.5,-.25,.4]) for (let sector=0;sector<8;sector++) {
      const angle=sector*Math.PI/4;
      directions.push(new THREE.Vector3(Math.sin(angle),y,Math.cos(angle)));
    }
    directions.push(new THREE.Vector3(0,-1,0));
    for (let i=0;i<vertices.length;i++) {
      const p=vertices[i];
      if (p.y > bounds.min.y + shoulderHeight*.27) continue;
      let slot=0;
      for (let j=1;j<4;j++) if (influence.getComponent(i,j)>influence.getComponent(i,slot)) slot=j;
      const key=joints.getComponent(i,slot);
      let hull=hulls.get(key);
      if (!hull) {hull=directions.map(()=>({id:i,projection:-Infinity}));hulls.set(key,hull);}
      directions.forEach((axis,d)=>{
        const projection=p.dot(axis);
        if (projection>hull[d].projection) {hull[d].projection=projection;hull[d].id=i;}
      });
    }
    return [...new Set(Array.from(hulls.values()).flatMap(hull=>hull.map(point=>point.id)))];
  });
  mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); root.remove(gltf.scene);
  return {gltf,scale,offset:new THREE.Vector3(-midX,-bounds.min.y,-midZ).multiplyScalar(scale),feet,seat,padding};
}

/** Preserve stripes, eyes and mane markings under the elemental coat. Pigment sits
 * in the midtones; the rim has a different hue from the lit fur. */
function finishMaterial(source: THREE.Material, element: AnimalElement | null, insignia?:THREE.Texture) {
  const mat=source.clone();
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
  mat.roughness = Math.max(.72,mat.roughness); mat.metalness=0;
  if (mat.map) mat.map.anisotropy=4;
  if (element) {
    const e=elementPaint[element];
    mat.onBeforeCompile = shader => {
      shader.uniforms.coatPigment={value:new THREE.Color(e.fur)};
      shader.uniforms.coatLight={value:new THREE.Color(e.light)};
      shader.uniforms.coatInsignia={value:insignia};
      shader.vertexShader="attribute vec3 flank; varying vec3 vFlank;\n"+shader.vertexShader
        .replace("#include <begin_vertex>","#include <begin_vertex>\n vFlank=flank;");
      shader.fragmentShader="uniform vec3 coatPigment,coatLight; uniform sampler2D coatInsignia; varying vec3 vFlank;\n"+shader.fragmentShader
        .replace("#include <map_fragment>",`#include <map_fragment>
          float pigmentValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          float pigmentMask=smoothstep(.024,.20,pigmentValue)*(1.-.78*smoothstep(.48,.87,pigmentValue));
          diffuseColor.rgb=mix(diffuseColor.rgb,coatPigment*(.16+1.32*pigmentValue),pigmentMask*.68);
          vec4 crest=texture2D(coatInsignia,vFlank.xy);
          float engraving=crest.a*vFlank.z;
          diffuseColor.rgb=mix(diffuseColor.rgb,crest.rgb,engraving*.82);`)
        .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
          float silverEdge=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),3.4);
          totalEmissiveRadiance+=coatLight*silverEdge*.33+crest.rgb*engraving*.85;`);
    };
    mat.customProgramCacheKey=()=>"farm-element-coat-v1";
  }
  return mat;
}

function makeActor(asset: ReturnType<typeof prepare>, species: Species, element: AnimalElement|null, saddled:boolean, outer:THREE.Group, insignia?:THREE.Texture) {
  const skin=cloneSkeleton(asset.gltf.scene), model=new THREE.Group();
  model.scale.setScalar(asset.scale); model.position.copy(asset.offset);
  model.add(skin); outer.add(model);
  const materials=new Map<THREE.Material,THREE.Material>();
  const meshes=skinnedMeshes(skin);
  function material(m:THREE.Material) {
    let clone=materials.get(m);
    if (!clone) { clone=finishMaterial(m,element,insignia); materials.set(m,clone); }
    return clone;
  }
  for (const mesh of meshes) {
    mesh.material=Array.isArray(mesh.material) ? mesh.material.map(material) : material(mesh.material);
    mesh.castShadow=mesh.receiveShadow=true;
  }
  const mixer=sampleNeutral(skin,asset.gltf.animations);
  const action = (name:string) => {
    const clip=THREE.AnimationClip.findByName(asset.gltf.animations,name);
    if (!clip) return;
    const a=mixer.clipAction(clip); a.play(); return a;
  };
  const idle=action("idle"),walk=action("walk"),run=action("run"),feeding=saddled?undefined:action("feeding");
  for(const a of [walk,run,feeding]) a?.setEffectiveWeight(0);
  const regalia=createMountRegalia(species,element,saddled);
  regalia.back.name="saddle-seat"; regalia.head.name="animal-crown";
  const [headName,spineName]=anatomy[species];
  const head=skin.getObjectByName(headName),spine=skin.getObjectByName(spineName);
  const v=new THREE.Vector3(), contact=new THREE.Vector3(), inv=new THREE.Matrix4();
  outer.updateWorldMatrix(true,false);
  outer.updateMatrixWorld(true);
  if (regalia.head.children.length && head) {
    outer.add(regalia.head);
    regalia.head.position.copy(outer.worldToLocal(head.getWorldPosition(v)));
    regalia.head.position.y+=saddleHeight(species)*.075;
    regalia.head.position.z+=saddleHeight(species)*.065;
    outer.updateMatrixWorld(true); head.attach(regalia.head);
  }
  if (regalia.back.children.length) {
    outer.add(regalia.back); regalia.back.position.y=saddleHeight(species);
    if (spine) { outer.updateMatrixWorld(true); spine.attach(regalia.back); }
  }
  let previousTime=NaN,blend=0,runBlend=0,graze=0,restTime=0,seatHeight=saddleHeight(species);
  return {
    get seatHeight(){return seatHeight;},
    animate(time:number,phase:number,stride:number,distanceSquared:number) {
      const interval=distanceSquared>38**2?.10:distanceSquared>22**2?1/30:0;
      if (Number.isFinite(previousTime) && time-previousTime<interval) return;
      const dt=Number.isFinite(previousTime)?THREE.MathUtils.clamp(time-previousTime,0,.25):0;
      if (!Number.isFinite(previousTime)) {
        const offset=THREE.MathUtils.euclideanModulo(phase/(2*Math.PI),1);
        for (const a of [idle,walk,run]) if (a) a.time=a.getClip().duration*offset;
      }
      previousTime=time;
      blend=THREE.MathUtils.damp(blend,THREE.MathUtils.smoothstep(stride,.02,.27),12,dt);
      runBlend=THREE.MathUtils.damp(runBlend,run?THREE.MathUtils.smoothstep(stride,.67,.96):0,9,dt);
      restTime=stride<.015?restTime+dt:0;
      graze=THREE.MathUtils.damp(graze,feeding&&restTime>1.2?1:0,3.5,dt);
      idle?.setEffectiveWeight((1-blend)*(1-graze));
      feeding?.setEffectiveWeight((1-blend)*graze);
      walk?.setEffectiveWeight(blend*(1-runBlend)).setEffectiveTimeScale(.5+stride*.85);
      run?.setEffectiveWeight(blend*runBlend).setEffectiveTimeScale(1.16);
      mixer.update(dt);
      outer.updateWorldMatrix(true,false); model.updateMatrixWorld(true); inv.copy(outer.matrixWorld).invert();
      let floor=Infinity;
      for (let i=0;i<meshes.length;i++) for (const id of asset.feet[i]) {
        meshes[i].getVertexPosition(id,v).applyMatrix4(meshes[i].matrixWorld).applyMatrix4(inv);
        floor=Math.min(floor,v.y);
      }
      if (Number.isFinite(floor)) model.position.y-=floor;
      // The saddle follows a point on the actual skinned back. A spine joint
      // alone can sit several centimetres above the fur as the animal gallops.
      if (saddled && asset.seat && regalia.back.parent) {
        const {mesh,ids,weights}=asset.seat, body=meshes[mesh];
        contact.set(0,0,0);
        for(let i=0;i<3;i++) contact.addScaledVector(body.getVertexPosition(ids[i],v),weights[i]);
        body.localToWorld(contact); outer.worldToLocal(contact);
        contact.y+=asset.padding;
        seatHeight=contact.y;
        outer.localToWorld(contact);
        regalia.back.position.copy(regalia.back.parent.worldToLocal(contact));
      }
    },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(skin);
      regalia.dispose(); model.removeFromParent(); regalia.back.removeFromParent(); regalia.head.removeFromParent();
      for (const m of materials.values()) m.dispose();
      for (const mesh of meshes) mesh.skeleton.dispose();
    },
  };
}

export function createProfessionalLibrary() {
  const templates=new Map<Species,Promise<ReturnType<typeof prepare>>>();
  const insignias=new Map<AnimalElement,THREE.Texture>();
  let closed=false;
  return {
    create(species:Species,element:AnimalElement|null,saddled:boolean) {
      const group=new THREE.Group();
      let actor:ReturnType<typeof makeActor>|undefined,disposed=false;
      let pending=templates.get(species);
      if (!pending) {
        pending=loader.loadAsync(files["./professionalModels/"+species+".glb"]).then(gltf=>prepare(species,gltf));
        templates.set(species,pending);
      }
      const ready=pending.then(asset=>{
        if (disposed||closed) return;
        if (element&&!insignias.has(element)) insignias.set(element,makeElementInsignia(element));
        actor=makeActor(asset,species,element,saddled,group,element?insignias.get(element):undefined);
      })
        .catch(error=>{ if(templates.get(species)===pending) templates.delete(species); console.error("动物模型加载失败",species,error); });
      return {group,ready,get seatHeight(){return actor?.seatHeight??saddleHeight(species);},
        animate(time:number,phase:number,stride:number,distanceSquared=0) { actor?.animate(time,phase,stride,distanceSquared); },
        dispose(){disposed=true;actor?.dispose();group.clear();}};
    },
    dispose(){
      closed=true;
      for (const p of templates.values()) void p.then(a=>releaseGltf(a.gltf),()=>{});
      for (const texture of insignias.values()) texture.dispose();
      templates.clear();insignias.clear();
    },
  };
}
