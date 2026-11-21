import * as THREE from "three";
import type { AnimalSpecies } from "../game/ranch";
import { styles } from "./ranchSpecies";
import { Sculpt,type Point,type Weights } from "./ranchSculpt";
import { isBird,isWildlife,ribsFor } from "./wildlifeAnatomy";

type UV=[number,number];
type Socket={kind:"leg"|"ear"|"wing";s:number;front:boolean;start:number;end:number;lo:number;hi:number;bone:number};
const N=32,TAU=Math.PI*2;
const bodyUv=(k:number,j:number):UV=>[.015+.97*k/24,.012+.626*j/N];
const plain=(u:number):UV=>[u,.983];
const chart=(j:number,t:number,k:"leg"|"wing"|"ear"):UV=>[
  (k==="leg"?.015:k==="ear"?.284:.466)+j*(k==="leg"?.253:k==="ear"?.159:.142),.66+t*.28];
const bound=(bone:number):Weights=>[[bone,1]];
const blend=(a:number,b:number,v:number):Weights=>[[a,1-v],[b,v]];

export function buildShape(species:AnimalSpecies){
  if(!isWildlife(species))throw Error("No original sculpt for "+species);
  const ribs=ribsFor(species),{body,size}=styles[species],{width:w,belly:b,length:l,leg,face:f}=body;
  const bird=isBird(species),alpaca=species==="alpaca";
  const penguin=species==="penguin",crane=species==="crane",duck=species==="duck",red=species==="redPanda";
  const g=new Sculpt(),pivots:Point[]=[[0,0,0],[0,ribs[14].y,ribs[14].z],[0,ribs[4].y,ribs[4].z]];
  const parents=[-1,0,0],legBones:number[]=[],wings:number[]=[];
  function addBone(at:Point,parent:number){parents.push(parent);return pivots.push(at)-1;}
  const ringPoint=(k:number,j:number):Point=>{
    const r=ribs[k],a=j/N*TAU,si=Math.sin(a),co=Math.cos(a);
    const head=k>=16&&k<=20;
    const curve=(v:number,exp:number)=>Math.sign(v)*Math.pow(Math.abs(v),exp);
    // The shoulder blade, rib cage, abdomen, jowls and sagittal brow each have their own section.
    const haunch=k>=5&&k<=7,shoulder=k>=10&&k<=12,eyeLine=k>=18&&k<=19;
    const side=Math.abs(si),cheek=!bird&&head&&co<0?1+.10*side:1;
    const x=r.x+r.w*si*cheek*(shoulder&&!bird?1+.055*Math.cos(3*a):1);
    let v=r.d*curve(co,head&&!bird?.85:1);
    if(!bird&&(haunch||shoulder))v+=r.d*.10*Math.exp(-((side-.62)**2)/.035)*Math.max(0,co);
    if(!bird&&eyeLine)v-=r.d*.042*Math.exp(-((co-.42)**2)/.031);
    if(bird&&co<0&&k>=7&&k<=12)v*=1+.08*(1-side);
    return [x,r.y+v*Math.cos(r.pitch),r.z-v*Math.sin(r.pitch)];
  };
  const bodyWeights=(k:number)=>k<5?blend(0,2,Math.min(.98,(5-k)*.28))
    :k>12?blend(0,1,Math.min(1,(k-12)/3)):bound(0);
  const ids=ribs.map((_,k)=>Array.from({length:N},(_,j)=>g.point(ringPoint(k,j),bodyWeights(k))));
  const sockets:Socket[]=[];
  for(const s of [-1,1]){
    for(const front of bird?[false]:[false,true]){
      const start=bird?(penguin?5:7):front?10:5,end=start+(bird?2:3);
      const z=(ribs[start].z+ribs[end].z)/2;
      const hip:Point=[s*w*(bird?.46:.73),bird?ribs[start].y-.02:leg+b*.61,z];
      const knee:Point=[s*w*.76,leg*(bird?.53:front?.65:.78),z+l*(bird?.04:front?-.11:.24)];
      const hock:Point=[s*w*.76,leg*(bird?.22:.29),z+l*(bird?-.02:front?-.05:-.13)];
      const bone=addBone(hip,0);addBone(knee,bone);addBone(hock,bone+1);legBones.push(bone);
      sockets.push({kind:"leg",s,front,start,end,lo:s===1?8:18,hi:s===1?14:24,bone});
    }
    if(!bird)sockets.push({kind:"ear",s,front:false,start:15,end:17,lo:s===1?2:24,hi:s===1?8:30,bone:1});
    else{
      const r=ribs[11],bone=addBone([s*r.w*.81,r.y+.04,r.z],0);wings.push(bone);
      sockets.push({kind:"wing",s,front:false,start:9,end:12,lo:s===1?3:21,hi:s===1?11:29,bone});
    }
  }
  for(let k=0;k<24;k++)for(let j=0;j<N;j++){
    if(sockets.some(s=>s.start<=k&&k<s.end&&s.lo<=j&&j<s.hi))continue;
    g.quad([ids[k][j],ids[k+1][j],ids[k+1][(j+1)%N],ids[k][(j+1)%N]],[bodyUv(k,j),bodyUv(k+1,j),bodyUv(k+1,j+1),bodyUv(k,j+1)]);
  }
  g.quad(ids[0],ids[0].map((_,j)=>bodyUv(0,j)));
  const nose=ids[24].slice().reverse();
  g.quad(nose,nose.map((_,j)=>bird?bodyUv(24,N-j):plain(.943)));

  // Tapered contours for toes, eyelids, individual feathers and the long hackles.
  function sweep(path:Point[],widths:number[],thickness:number,bone:number,swatch:number,ref:Point=[0,1,0]){
    const spline=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(...p)),false,"centripetal");
    const rings:number[][]=[],rows=4*(path.length-1),sides=8,up=new THREE.Vector3(...ref);
    for(let k=0;k<=rows;k++){
      const t=k/rows,pos=spline.getPoint(t),dir=spline.getTangent(t);
      const cross=new THREE.Vector3().crossVectors(dir,up);
      if(cross.lengthSq()<1e-6)cross.crossVectors(dir,new THREE.Vector3(1,0,0));
      cross.normalize();const normal=new THREE.Vector3().crossVectors(cross,dir).normalize();
      const idx=Math.min(widths.length-2,Math.floor(t*(widths.length-1)));
      const rad=THREE.MathUtils.lerp(widths[idx],widths[idx+1],t*(widths.length-1)-idx);
      rings.push(Array.from({length:sides},(_,j)=>{
        const a=j/sides*TAU;
        return g.point(pos.clone().addScaledVector(cross,rad*Math.cos(a)).addScaledVector(normal,rad*thickness*Math.sin(a)).toArray() as Point,bound(bone));
      }));
    }
    for(let i=0;i<rows;i++)for(let j=0;j<sides;j++){
      const n=(j+1)%sides;
      g.quad([rings[i][j],rings[i][n],rings[i+1][n],rings[i+1][j]].reverse(),Array(4).fill(plain(swatch)));
    }
    g.quad(rings[0],rings[0].map(()=>plain(swatch)));
    g.quad(rings[rows].slice().reverse(),rings[rows].map(()=>plain(swatch)));
  }

  for(const socket of sockets){
    const {start,end,lo,hi,s,kind,bone,front}=socket,perimeter:number[]=[];
    const rootUV:UV[]=[];
    for(let k=start;k<end;k++)rootUV.push(bodyUv(k,lo));
    for(let j=lo;j<hi;j++)rootUV.push(bodyUv(end,j));
    for(let k=end;k>start;k--)rootUV.push(bodyUv(k,hi));
    for(let j=hi;j>lo;j--)rootUV.push(bodyUv(start,j));
    const rootCentre=rootUV.reduce<UV>((a,v)=>[a[0]+v[0]/rootUV.length,a[1]+v[1]/rootUV.length],[0,0]);
    for(let k=start;k<end;k++)perimeter.push(ids[k][lo]);
    for(let j=lo;j<hi;j++)perimeter.push(ids[end][j]);
    for(let k=end;k>start;k--)perimeter.push(ids[k][hi]);
    for(let j=hi;j>lo;j--)perimeter.push(ids[start][j]);
    const c=new THREE.Vector3();
    for(const v of perimeter)c.add(g.vertices[v].p);c.divideScalar(perimeter.length);
    const dx=Math.max(.002,...perimeter.map(i=>Math.abs(g.vertices[i].p.x-c.x)));
    const dz=Math.max(.002,...perimeter.map(i=>Math.abs(g.vertices[i].p.z-c.z)));
    const dy=Math.max(.002,...perimeter.map(i=>Math.abs(g.vertices[i].p.y-c.y)));
    const directions=perimeter.map(id=>{
      const p=g.vertices[id].p;
      const a=Math.atan2((p.z-c.z)/dz,kind==="wing"?(p.y-c.y)/dy:(p.x-c.x)/dx);
      return [Math.cos(a),Math.sin(a)];
    });
    const stages=9,forefootZ=c.z+l*(bird?.18:front?.13:.07);
    let previous=perimeter;
    for(let step=0;step<stages;step++){
      const t=(step+1)/stages;
      let nextVertex=0;
      const next=directions.map(([u,v])=>{
        let at:Point,skin:Weights;
        if(kind==="leg"){
          const pad=bird?(penguin?.105:.058):alpaca?.134:.205;
          const radX=bird?[.19,.105,.063,.057,.056,.054,.058,pad,.05]
            :[front?.402:.48,front?.332:.443,front?.286:.35,.253,.212,.195,.199,pad*1.12,pad];
          const radZ=bird?[.19,.12,.081,.062,.066,.06,.086,.16,.115]
            :[front?.49:.57,front?.39:.52,front?.31:.39,.269,.23,.20,.24,alpaca?.27:.39,alpaca?.25:.36];
          const levels=[.99,.86,.67,.53,.37,.26,.155,.076,.020];
          const deltas=bird?[0,.02,.049,.040,.013,-.023,.018,.115,.15]
            :front?[.03,-.037,-.092,-.065,-.027,-.013,.004,.070,.110]
              :[.016,.145,.240,.155,-.018,-.151,-.134,-.016,.058];
          const xpos=s*w*(bird?.52:.72);
          at=[xpos+w*radX[step]*u,Math.max(.007,leg*levels[step]),c.z+l*deltas[step]+b*radZ[step]*v];
          skin=step===0?blend(0,bone,.76):step<2?bound(bone):step===2?blend(bone,bone+1,.60)
            :step<5?bound(bone+1):step===5?blend(bone+1,bone+2,.62):bound(bone+2);
          if(step===0){
            const vtx=perimeter[nextVertex++];
            const src=g.vertices[vtx].p;
            at=[.62*at[0]+.38*src.x,.62*at[1]+.38*src.y,.62*at[2]+.38*src.z];
          }
        }else if(kind==="ear"){
          const h=alpaca?1.65:red?.98:.70;
          const profile=[.84,.91,.90,.82,.70,.54,.37,.18,.024][step];
          at=[c.x+s*f*(.095+t*(alpaca?.41:.43))+u*f*.405*profile,
              c.y+t*f*h,c.z-f*t*(alpaca?.36:.30)+v*f*.22*profile-u*s*f*.09*profile];
          skin=bound(1);
        }else{
          const profile=[.80,.96,1,.96,.88,.74,.56,.34,.046][step];
          const tipZ=penguin?.15:crane?.55:.43,drop=penguin?.297:crane?.13:.052;
          at=[c.x+s*(penguin?.06:.046)*Math.sin(t*Math.PI*.86)+u*s*.018*profile,
            c.y-drop*t+u*(penguin?.075:.077)*profile,c.z-tipZ*t+v*(penguin?.039:.112)*profile];
          skin=step<2?blend(0,bone,.40+t):bound(bone);
        }
        return g.point(at,skin);
      });
      for(let j=0;j<next.length;j++){
        const n=(j+1)%next.length;
        if(step===0){
          const inset=(q:UV):UV=>[q[0]*.79+rootCentre[0]*.21,q[1]*.79+rootCentre[1]*.21];
          g.quad([previous[j],previous[n],next[n],next[j]],[rootUV[j],rootUV[n],inset(rootUV[n]),inset(rootUV[j])]);
          continue;
        }
        g.quad([previous[j],previous[n],next[n],next[j]],[
          chart(j/next.length,step/stages,kind),chart((j+1)/next.length,step/stages,kind),
          chart((j+1)/next.length,t,kind),chart(j/next.length,t,kind)]);
      }
      previous=next;
    }
    g.quad(previous,previous.map(()=>chart(.5,1,kind)));
    if(kind==="leg"){
      const digits=bird?3:alpaca?2:5;
      const toeLen=bird?(crane?.137:duck?.102:.082):alpaca?.051:.043;
      const xo=w*(bird?.52:.72),span=bird?(crane?.044:.047):w*(alpaca?.21:.20);
      for(let i=0;i<digits;i++){
        const t=digits>1?2*i/(digits-1)-1:0,x=s*xo+t*span,z=forefootZ-.03;
        const tipX=x+t*(bird?.036:.007),tipZ=z+toeLen*(1-.22*Math.abs(t));
        sweep([[x,.018,z],[x+.35*(tipX-x),.017,z+toeLen*.48],[tipX,.012,tipZ],[tipX,.007,tipZ+.012]],
          [alpaca?.024:.011,alpaca?.022:.012,.006,.001],.60,bone+2,bird?.845:alpaca?.943:.77);
        if(duck&&i<digits-1){
          const neighbour=x+span;
          const vertices=[[x,.015,z],[neighbour,.014,z],[neighbour+.024,.006,tipZ],[x+.01,.008,tipZ-.017],[tipX,.008,tipZ]];
          const face=vertices.map(v=>g.point(v as Point,bound(bone+2)));g.quad(face.reverse(),face.map(()=>plain(.845)));
        }
      }
    }
    if(kind==="wing"&&!penguin){
      for(let i=0;i<7;i++){
        const a=i/6,x=s*(duck?.136:.147),z=(duck?-.055:-.091)-a*(duck?.055:.077);
        const y=c.y-.026+.057*a,tip=z-(crane?.384:.247)+a*.078;
        sweep([[x,y,z],[x+s*.013,y-.018,z-.075],[x-s*.026,y-.053-.029*(1-a),tip+.062],[x-s*.054,y-.062-.050*(1-a),tip]],
          [.008,.043,crane?.043:.037,.001],.16,bone,i%3?.772:.819,[s,.12,0]);
      }
    }
  }

  // Directional guard-hair clumps grow from the cheek plane toward the ruff.
  // Each tapered blade follows the local direction of fur growth.
  if(!bird){
    const brow=ribs[18];
    for(const s of [-1,1]){
      for(let i=0;i<(alpaca?5:8);i++){
        const k=i%4,row=Math.floor(i/4),a=(.27+.065*k+.018*row)*Math.PI;
        const face=ribs[row?15:16],v=face.d*Math.cos(a),x=face.w*Math.sin(a)*s;
        const length=f*(alpaca?.52:red?.77:.51)*(1+k*.056);
        sweep([[x*.95,face.y+v,face.z],[x+s*f*.077,face.y+v-.15*length,face.z-.29*length],
          [x+s*f*.107,face.y+v-.44*length,face.z-.69*length],
          [x+s*f*.072,face.y+v-.60*length,face.z-length]],
          [f*.035,f*(row?.137:.160),f*.107,.001],.32,1,row?.742:.795,[s,.11,0]);
      }
      // Eyes project gently from the head and share its skin bone. Each convex cornea
      // carries its own limbus, iris, pupil and two small specular reflections.
      const eyeR=ribs[18];
      const centre=new THREE.Vector3(...ringPoint(18,s>0?6:N-6));
      const direction=new THREE.Vector3(s*.86,.29,.42).normalize();
      centre.addScaledVector(direction,-.005);
      const horizontal=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
      const up=new THREE.Vector3().crossVectors(direction,horizontal).normalize();
      const irisSize=eyeR.w*(alpaca?.18:.162);
      const eyeShell=(rad:number,top:number,offsetX:number,offsetY:number,swatch:number)=>{
        const rows:number[][]=[];
        const anchor=centre.clone().addScaledVector(horizontal,offsetX*irisSize).addScaledVector(up,offsetY*irisSize);
        for(let k=0;k<5;k++){
          const angle=(k+.02)/4.03*Math.PI/2;
          rows.push(Array.from({length:16},(_,j)=>{
            const a=j*Math.PI/8;
            const pos=anchor.clone().addScaledVector(horizontal,Math.cos(a)*Math.sin(angle)*irisSize*rad)
              .addScaledVector(up,Math.sin(a)*Math.sin(angle)*irisSize*rad*.89)
              .addScaledVector(direction,irisSize*(top+.20*rad*Math.cos(angle)));
            return g.point(pos.toArray() as Point,bound(1));
          }));
          if(k)for(let j=0;j<16;j++){
            const n=(j+1)%16;g.quad([rows[k-1][j],rows[k][j],rows[k][n],rows[k-1][n]],Array(4).fill(plain(swatch)));
          }
        }
      };
      eyeShell(1,.23,0,0,.929);eyeShell(.75,.45,0,0,.894);eyeShell(.51,.60,0,0,.929);
      eyeShell(.158,.745,-s*.24,.29,.875);eyeShell(.063,.748,s*.28,-.17,.875);
      // The supraorbital arch follows the upper face, clear of the cornea.
      const face=(j:number,k:number)=>ringPoint(k,s>0?j:N-j);
      const pt=face(3.53,17),pa=face(3.79,18),pb=face(4.13,19);
      sweep([pt,[pa[0]*1.013,pa[1]+f*.013,pa[2]],pb],[.002,f*.024,.001],.35,1,.744,[s,0,0]);
      if(red||species==="raccoon")for(let i=0;i<3;i++){
        sweep([[s*brow.w*.48,brow.y-f*(.18+i*.08),ribs[21].z],[s*brow.w*1.03,brow.y-f*(.19+i*.10),ribs[22].z],
          [s*brow.w*(1.53+i*.06),brow.y-f*(.21+i*.14),ribs[22].z-f*.05]],
          [.0024,.0018,.0005],1,1,.667);
      }
    }
    if(alpaca)for(let i=-3;i<=3;i++){
      const t=i/3,x=t*f*.6,y=ribs[17].y+f*(.84-.16*t*t),z=ribs[17].z;
      sweep([[x,y,z-.06],[x+.012,y+.021,z-.017],[x+.016,y+.009,z+.018],[x+.017,y-.012,z+.033]],
        [.010,.018,.012,.002],.52,1,.795);
    }
  }
  return {geometry:g.surface(),pivots,parents,legBones,wings,size};
}
