import * as THREE from "three";
import type { AnimalElement, AnimalSpecies } from "../game/ranch";
import { elementPaint } from "./ranchSpecies";

type Point = [number,number,number];
const V = (p: Point) => new THREE.Vector3(...p);
const palette = { gold:0xd6a357, pale:0xffdea0, bronze:0x634638, oxblood:0x663d37, leather:0x392c32 };

class Metalwork {
  positions:number[]=[]; colours:number[]=[]; finish:number[]=[]; indices:number[]=[];
  vertex(p:THREE.Vector3,colour:number,metal:number,light=0){
    const c=new THREE.Color(colour);
    this.positions.push(p.x,p.y,p.z); this.colours.push(c.r,c.g,c.b); this.finish.push(metal,light);
    return this.positions.length/3-1;
  }
  quad(a:number,b:number,c:number,d:number){this.indices.push(a,b,d,b,c,d);}
  wire(points:Point[],radius:number,colour:number,metal=.68,light=0){
    const path=new THREE.CatmullRomCurve3(points.map(V));
    const geo=new THREE.TubeGeometry(path,Math.max(6,points.length*3),radius,5,false);
    const p=geo.getAttribute("position"),offset=this.positions.length/3;
    for(let i=0;i<p.count;i++)this.vertex(new THREE.Vector3().fromBufferAttribute(p,i),colour,metal,light);
    for(const i of geo.index!.array)this.indices.push(offset+i);
    geo.dispose();
  }
  blade(points:Point[],width:number,colour:number,edge:number,luminous:number,normal:Point=[0,0,1]){
    const path=new THREE.CatmullRomCurve3(points.map(V)),ref=V(normal).normalize(),rows:number[][]=[];
    for(let j=0;j<=8;j++){
      const t=j/8,p=path.getPoint(t),dir=path.getTangent(t),across=new THREE.Vector3().crossVectors(dir,ref).normalize();
      const w=width*(.04+.96*Math.pow(Math.sin(Math.PI*t),.78))*(1.18-.39*t);
      rows.push([this.vertex(p.clone().addScaledVector(across,-w),edge,.58),
        this.vertex(p.clone().addScaledVector(ref,.36*w),colour,.46,luminous),
        this.vertex(p.clone().addScaledVector(across,w*.81),edge,.63)]);
      if(j)for(let i=0;i<2;i++)this.quad(rows[j-1][i],rows[j][i],rows[j][i+1],rows[j-1][i+1]);
    }
  }
  jewel(centre:Point,radii:Point,colour:number,core:number){
    const rows:number[][]=[];const [x,y,z]=centre;
    for(const [offset,radius] of [[-.95,.12],[-.33,.97],[.19,1],[.76,.48],[1,.01]]){
      const row:number[]=[];
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4+Math.PI/8;
        row.push(this.vertex(new THREE.Vector3(x+radii[0]*radius*Math.cos(a),y+offset*radii[1],z+radii[2]*radius*Math.sin(a)),
          i%4===1&&offset>0?core:colour,.28,offset<0?.13:.46));
      }
      if(rows.length)for(let i=0;i<8;i++)this.quad(rows[rows.length-1][i],row[i],row[(i+1)%8],rows[rows.length-1][(i+1)%8]);
      rows.push(row);
    }
  }
  geometry(){
    if(!this.indices.length)return null;
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute("color",new THREE.Float32BufferAttribute(this.colours,3));
    g.setAttribute("enamel",new THREE.Float32BufferAttribute(this.finish,2));
    g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();
    return g;
  }
}

const headWidth: Record<AnimalSpecies,number>={
  wolf:.26,bear:.41,tiger:.32,lion:.39,elephant:.60,panda:.54,fox:.155,rabbit:.12,deer:.19,boar:.23,
  goat:.16,alpaca:.21,sheep:.19,horse:.26,flameHorse:.26,cow:.32,raccoon:.18,redPanda:.20,penguin:.11,duck:.105,crane:.09,
};
// Maximum half-width and skirt drop from sections of the animated mounts.
// These describe the rib cage, not the visibly narrower leather seat across it.
const blanketFit: Partial<Record<AnimalSpecies,[halfWidth:number,drop:number]>>={
  wolf:[.226,.249],bear:[.423,.338],tiger:[.252,.280],lion:[.284,.269],elephant:[.509,.405],panda:[.533,.339],horse:[.28,.28],flameHorse:[.28,.28],
};
const saddleColours: Record<AnimalElement,number>={metal:0x273d59,wood:0x285044,water:0x273e70,fire:0x742e42,earth:0x514357};

function crown(builder:Metalwork,species:AnimalSpecies,element:AnimalElement){
  const h=headWidth[species],paint=elementPaint[element],rim=element==="water"?0xb6d9e0:palette.gold;
  const point=(s:number,x:number,y:number,z:number):Point=>[s*x*h,y*h,z*h];
  const centre:Point=[0,.19*h,.30*h];
  for(const s of [-1,1]){
    const p=(x:number,y:number,z:number)=>point(s,x,y,z);
    builder.wire([p(0,.18,.30),p(.23,.29,.24),p(.43,.24,.13),p(.49,.05,.014)],.021*h,rim);
    builder.wire([p(.11,.22,.295),p(.24,.34,.23),p(.39,.36,.10),p(.44,.29,-.005)],.010*h,paint.light,.33,.27);
    switch(element){
      case "metal":{
        for(let i=0;i<3;i++)builder.blade([p(.29+i*.058,.26,.12-i*.055),p(.45+i*.045,.54-i*.041,-.02-i*.07),
          p(.64+i*.052,.85-i*.13,-.25-i*.07)],h*(.069-i*.011),paint.fur,palette.pale,.16);
        break;
      }
      case "wood":{
        const stem=[p(.36,.25,.03),p(.43,.51,-.04),p(.59,.68,-.13),p(.54,.93,-.28)];
        builder.wire(stem,h*.026,rim);
        for(let i=0;i<3;i++){
          const level=.43+.12*i,x=.424+.051*i;
          builder.blade([p(x,level,-.06*i),p(x+.19,level+.035,-.09-.05*i),p(x+.29,level+.17,-.17-.05*i)],
            h*(.076-i*.009),paint.light,0x4e9471,.19);
        }
        builder.jewel(stem[3],[.025*h,.049*h,.023*h],paint.core,0xfff0df);break;
      }
      case "water":{
        for(let i=0;i<3;i++)builder.blade([p(.28+i*.062,.24,.105-i*.036),p(.45+i*.082,.33+i*.04,-.11-i*.036),
          p(.52+i*.069,.57+i*.10,-.43-i*.063),p(.42+i*.065,.66+i*.122,-.56-i*.076)],
        h*(.09-i*.014),i===1?paint.core:paint.light,0x4b789c,.26);
        break;
      }
      case "fire":{
        for(let i=0;i<3;i++)builder.blade([p(.34+i*.047,.24,.11-i*.048),p(.48+i*.065,.49-i*.016,-.016-i*.033),
          p(.415+i*.092,.64-i*.020,-.101-i*.071),p(.47+i*.14,.98-i*.15,-.28-i*.06)],
        h*(.084-i*.014),i===1?paint.core:paint.light,0x98482f,.39);
        break;
      }
      case "earth":{
        for(let i=0;i<3;i++){
          const x=.36+i*.092,y=.39+i*.023;
          builder.blade([p(x-.045,.25,.09-i*.07),p(x,y+.12,-.046-i*.074),p(x+.075,.87-i*.135,-.182-i*.083)],
            h*(.103-i*.018),i===1?paint.light:paint.core,0x947560,.28);
        }break;
      }
    }
  }
  builder.jewel(centre,[.076*h,.122*h,.047*h],paint.light,paint.core);
}

function saddle(builder:Metalwork,species:AnimalSpecies,element:AnimalElement|null){
  const [half,drop]=blanketFit[species]??[.22,.25],length=.224+half*.49;
  const paint=element?elementPaint[element]:{light:0xd3b977,core:0xffe8ab};
  const cloth=element?saddleColours[element]:0x37504b;
  function fabric(cross:number,long:number):Point {
    const a=cross*1.52,wh=half*(1-.035*long*long);
    const x=wh*Math.sin(a),skirt=Math.abs(cross)**3;
    const fall=drop*(1-Math.cos(a))**1.32*(1-.16*long*long);
    const scallop=skirt*(.008+.010*Math.cos(3.2*long)+.010*(1-long)*.5);
    const endFall=species==="bear"?.031:species==="elephant"?.021:.009;
    return [x,-.020-fall-scallop-endFall*long*long,length*long*(1-.055*skirt)+(1-long*long)*skirt*.018];
  }
  let rows:number[][]=[];
  for(let j=0;j<=12;j++){
    const row:number[]=[];
    for(let i=0;i<=12;i++){
      const c=i/6-1,l=j/6-1;
      row.push(builder.vertex(V(fabric(c,l)),i<=1||i>=11?0x312e39:cloth,.09));
      if(j&&i)builder.quad(rows[j-1][i-1],row[i-1],row[i],rows[j-1][i]);
    }
    rows.push(row);
  }
  for(const s of [-1,1]){
    for(const distance of [.86,.99]){
      const path=Array.from({length:9},(_,i)=>fabric(s*distance,i/4-1));
      builder.wire(path,distance>.95?.007:.0035,palette.gold);
    }
    for(let j=0;j<5;j++){
      const l=j*.31-.62;
      const leaf=[fabric(s*.86,l-.115),fabric(s*.775,l-.035),fabric(s*.750,l+.051),fabric(s*.838,l+.090),fabric(s*.86,l-.115)];
      builder.wire(leaf,.003,paint.light,.35,.18);
      builder.wire([fabric(s*.86,l-.115),fabric(s*.79,l+.006),fabric(s*.75,l+.051)],.0018,palette.pale,.4,.12);
    }
    const bottom=-drop-.079,stirrupX=half+.017;
    const strap=[fabric(s*.42,.17),fabric(s*.68,.17),fabric(s*.85,.15),fabric(s,.14)];
    for(const p of strap){p[0]+=s*.004;p[1]+=.003;}
    strap.push([s*stirrupX,bottom+.057,.041]);
    builder.wire(strap,.011,palette.oxblood,.10);
    builder.wire([[s*stirrupX,bottom+.065,.041],[s*(stirrupX+.011),bottom+.036,.093],[s*(stirrupX+.018),bottom-.030,.104],
      [s*(stirrupX+.018),bottom-.039,-.013],[s*(stirrupX+.009),bottom+.029,-.014],[s*stirrupX,bottom+.065,.041]],.006,palette.gold);
  }
  const seatCross=Math.asin(Math.min(.82,.212/half))/1.52;
  function seatPoint(c:number,l:number):Point{
    const p=fabric(c*seatCross*(.83+.17*l*l),l*.72);
    p[1]+=.020+.045*Math.abs(l)**3*(1-.33*c*c)+(l<0?.012*l*l:0);
    return p;
  }
  rows=[];
  for(let j=0;j<=12;j++){
    const l=j/6-1,row:number[]=[];
    for(let i=0;i<=12;i++){
      const c=i/6-1,p=seatPoint(c,l);
      row.push(builder.vertex(V(p),i<=1||i>=11?palette.bronze:palette.oxblood,.13));
      if(j&&i)builder.quad(rows[j-1][i-1],row[i-1],row[i],rows[j-1][i]);
    }
    rows.push(row);
  }
  // The thin top is joined to the draped pad by a sculpted leather roll.
  const perimeter:[number,number][]=[];
  for(let i=0;i<12;i++)perimeter.push([i/6-1,-1]);
  for(let i=0;i<12;i++)perimeter.push([1,i/6-1]);
  for(let i=0;i<12;i++)perimeter.push([1-i/6,1]);
  for(let i=0;i<12;i++)perimeter.push([-1,1-i/6]);
  const edges=perimeter.map(([c,l])=>{
    const surface=seatPoint(c,l),base=fabric(c*seatCross*(.83+.17*l*l),l*.72);
    const outer=new THREE.Vector3(c*.006,-.005,l*.006);
    return [builder.vertex(V(surface),palette.bronze,.16),
      builder.vertex(V(surface).add(outer),palette.oxblood,.11),
      builder.vertex(V(base).add(new THREE.Vector3(c*.008,.001,l*.008)),palette.leather,.09)];
  });
  for(let i=0;i<edges.length;i++)for(let j=0;j<2;j++){
    const n=(i+1)%edges.length;builder.quad(edges[i][j],edges[i][j+1],edges[n][j+1],edges[n][j]);
  }
  for(const tip of [-1,1]){
    builder.wire(Array.from({length:9},(_,i)=>seatPoint(i/4-1,tip)),.006,palette.bronze);
    builder.wire(Array.from({length:11},(_,i)=>seatPoint(tip,i/5-1)),.0037,palette.gold);
  }
}

function regaliaMaterial(){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.58,metalness:.55});
  m.onBeforeCompile=shader=>{
    shader.vertexShader="attribute vec2 enamel; varying vec2 vEnamel;\n"+shader.vertexShader.replace("#include <color_vertex>","#include <color_vertex>\nvEnamel=enamel;");
    shader.fragmentShader="varying vec2 vEnamel;\n"+shader.fragmentShader
      .replace("#include <metalnessmap_fragment>","#include <metalnessmap_fragment>\nmetalnessFactor=vEnamel.x;")
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=mix(.76,.32,vEnamel.x);")
      .replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vEnamel.y;");
  };
  return m;
}

interface Garment {crown:THREE.BufferGeometry|null;tack:THREE.BufferGeometry|null;material:THREE.Material;count:number}
const wardrobe=new Map<string,Garment>();

/** Both mounts use metres and face +Z. Attach the groups to the brow and seat bones. */
export function createMountRegalia(species:AnimalSpecies,element:AnimalElement|null,saddled:boolean){
  const head=new THREE.Group(),back=new THREE.Group();
  if(!element&&!saddled)return {head,back,dispose(){}};
  const key=[species,element,saddled].join("/");
  let garment=wardrobe.get(key);
  if(!garment){
    const brow=new Metalwork(),seat=new Metalwork();
    if(element)crown(brow,species,element);
    if(saddled)saddle(seat,species,element);
    garment={crown:brow.geometry(),tack:seat.geometry(),material:regaliaMaterial(),count:0};wardrobe.set(key,garment);
  }
  const template=garment;template.count++;
  for(const [group,geometry] of [[head,template.crown],[back,template.tack]] as const){
    if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,template.material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  let disposed=false;
  return {head,back,dispose(){
    if(disposed)return;
    disposed=true;head.clear();back.clear();
    if(--template.count===0){
      template.crown?.dispose();template.tack?.dispose();template.material.dispose();wardrobe.delete(key);
    }
  }};
}
