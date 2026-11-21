import * as THREE from "three";
import { MOUNT_UNLOCK_LEVEL } from "../game/ranch";
import { RanchGeometry } from "./ranchGeometry";
import type { WorldObstacles } from "./obstacles";
import { GATE_WIDTH, RANCH_ENTRANCE, ranchBounds } from "./ranchLayout";

function paintedSign(text:string,width:number,height:number) {
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const c=canvas.getContext("2d")!;
  c.fillStyle="#305a51";c.fillRect(0,0,512,128);
  c.strokeStyle="#dabc85"; c.lineWidth=6;c.strokeRect(9,8,494,112);
  c.fillStyle="#fff1ca";c.font="bold 69px system-ui, sans-serif";c.textAlign="center";c.textBaseline="middle";
  c.fillText(text,256,66,440);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));
  sign.rotation.y=Math.PI;
  return sign;
}

export function buildRanchPen(level:number,obstacles:WorldObstacles) {
  const bounds=ranchBounds(level),{north,south,west,east}=bounds;
  const divider=west+(east-west)*.48, gateX=RANCH_ENTRANCE.x, gap=GATE_WIDTH*.5;
  const g=new RanchGeometry();
  const group=new THREE.Group();group.name="ranch-pasture";
  const releases:Array<()=>void>=[];
  const pine=0xa16e4d, timber=0xe1b57e, cream=0xffe4b3, green=0x517d6b;
  function fence(x1:number,z1:number,x2:number,z2:number,stable=false){
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
    const n=Math.max(1,Math.round(length/2.05));
    releases.push(obstacles.addBox((x1+x2)/2,(z1+z2)/2,Math.abs(dx)/2+.07,Math.abs(dz)/2+.07));
    for(let k=0;k<=n;k++){
      const x=x1+dx*k/n,z=z1+dz*k/n;
      g.part("block",[x,.49,z],[.077,.48,.077],stable?green:pine);
      g.part("horn",[x,1.01,z],[.112,.10,.112],stable?0xd4a66b:cream,[0,Math.PI*.25,0]);
      if(k===n)continue;
      const ex=x+dx/n,ez=z+dz/n;
      for(const y of [.32,.71]) g.part("block",[(x+ex)/2,y,(z+ez)/2],[Math.abs(dx)/(2*n)+.04,.052,Math.abs(dz)/(2*n)+.04],stable?0x9ab396:timber);
    }
  }
  fence(west,north,gateX-gap,north);
  fence(gateX+gap,north,east,north);
  fence(east,north,east,south);
  fence(west,south,east,south);
  fence(west,north,west,south);
  const cx=(east+west)/2,cz=(north+south)/2;
  g.part("block",[cx,.014,cz],[(east-west)/2,.012,(south-north)/2],0xa7c283);
  // Scattered clover and warm tufts break up the large uninterrupted turf.
  for(let i=0;i<24+level*4;i++){
    const x=west+.5+((i*.6180339)%1)*(east-west-1);
    const z=north+.5+((i*.414214)%1)*(south-north-1);
    for(let j=0;j<3;j++)g.part("pebble",[x+.041*Math.cos(j*2.1),.037,z+.041*Math.sin(j*2.1)],[.057,.018,.069],j===1?0x96b777:0xb6ca8a);
  }
  for(const s of [-1,1]){
    const x=gateX+s*(gap+.10);
    g.part("block",[x,1.06,north],[.12,1.05,.13],pine);
    g.part("block",[x,.19,north],[.17,.18,.18],0xc5b69c);
    g.part("block",[x,2.06,north],[.16,.08,.17],cream);
    g.beam([x,1.63,north],[x-s*.48,2.12,north],.063,timber);
  }
  g.part("block",[gateX,2.18,north],[gap+.30,.12,.17],green);
  g.part("block",[gateX,2.34,north],[gap+.39,.055,.22],0x769985);
  const signs=[paintedSign("牧 场",1.62,.43)];
  signs[0].position.set(gateX,2.09,north-.18);
  if(level>=MOUNT_UNLOCK_LEVEL){
    // The small opening in this interior fence leads into the mount paddock.
    fence(divider,north+2.8,divider,south,true);
    g.part("block",[divider,1.04,north+2.8],[.083,1.03,.083],green);
    g.part("block",[divider,1.65,north+2.8],[.64,.19,.073],timber);
    const sign=paintedSign("坐骑栏",1.19,.33);
    sign.position.set(divider,1.66,north+2.72);signs.push(sign);
    // An open, tiled sunshade lets players see the mounts from the main gate.
    const sx=west+1.50,sz=south+.44;
    for(const side of [-1,1]){
      g.part("block",[sx+side*.94,1.58,sz+.23],[.087,1.58,.087],pine);
      releases.push(obstacles.addBox(sx+side*.94,sz+.23,.073,.073));
      g.part("block",[sx,3.17,sz+side*.44],[1.16,.078,.50],side>0?0x53887c:0x77a18b,[side*.18,0,0]);
    }
    g.part("block",[sx,3.27,sz],[1.20,.06,.10],cream);
  }
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.90});
  const meadow=new THREE.Mesh(g.finish(),mat);
  meadow.receiveShadow=meadow.castShadow=true;
  group.add(meadow,...signs);
  return {group,bounds,divider,dispose(){
    releases.forEach(release=>release());
    meadow.geometry.dispose();mat.dispose();
    signs.forEach(sign=>{sign.geometry.dispose();sign.material.map?.dispose();sign.material.dispose();});
  }};
}
