import type {AnimalSpecies,AnimalElement} from "../game/ranch";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import type {AnimalAsset} from "./ranchAnimalBake";

type GeometryData=AnimalAsset;
interface Accessor {bufferView:number;componentType:number;count:number;normalized?:boolean}
interface Mesh {name:string;primitives:{indices:number;attributes:Record<string,number>}[];extras:{lowIndices:number}}
interface Spec {bufferViews:{byteOffset:number;byteStride?:number}[];accessors:Accessor[];meshes:Mesh[];extras:Pick<GeometryData,"size"|"pivots"|"parents"|"legBones"|"wings">}
const files=import.meta.glob("./animalMeshes/*.glb.gz",{eager:true,query:"?url",import:"default"}) as Record<string,string>;
const recent=new Map<AnimalSpecies,{spec:Spec;bytes:ArrayBuffer;offset:number}>();
async function readSpecies(species:AnimalSpecies){
  let glb=recent.get(species);
  if(!glb){
    const url=files["./animalMeshes/"+species+".glb.gz"];
    const response=await fetch(url);
    if(!response.ok)throw Error("Unable to load animal model "+species);
    let bytes=await response.arrayBuffer();
    // Static servers may supply Content-Encoding: gzip, in which case fetch already decoded the GLB.
    const signature=new Uint8Array(bytes,0,2);
    if(signature[0]===0x1f&&signature[1]===0x8b)bytes=typeof DecompressionStream==="function"
      ?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
      :new Uint8Array(gunzipSync(new Uint8Array(bytes))).buffer;
    if(new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error("Invalid animal GLB "+species);
    const jsonSize=new DataView(bytes).getUint32(12,true);
    const spec=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,jsonSize))) as Spec;
    glb={spec,bytes,offset:28+jsonSize};
    if(recent.size>=4)recent.delete(recent.keys().next().value!);
    recent.set(species,glb);
  }
  return glb;
}
export async function loadSculpt(species:AnimalSpecies,element:AnimalElement|null,saddled:boolean):Promise<GeometryData>{
  const {spec,bytes,offset}=await readSpecies(species);
  const parts=spec.meshes.filter(m=>m.name==="body"||m.name===element||saddled&&m.name==="saddle");
  const typed=(id:number,width:number)=>{
    const a=spec.accessors[id],view=spec.bufferViews[a.bufferView],pos=offset+view.byteOffset,len=a.count*width;
    if(view.byteStride&&view.byteStride!==width&&a.componentType<=5121){
      const source=a.componentType===5120?new Int8Array(bytes,pos,a.count*view.byteStride):new Uint8Array(bytes,pos,a.count*view.byteStride);
      const packed=a.componentType===5120?new Int8Array(len):new Uint8Array(len);
      for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)packed[i*width+j]=source[i*view.byteStride+j];
      return packed;
    }
    if(a.componentType===5120)return new Int8Array(bytes,pos,len);
    if(a.componentType===5121)return new Uint8Array(bytes,pos,len);
    if(a.componentType===5123)return new Uint16Array(bytes,pos,len);
    return new Float32Array(bytes,pos,len);
  };
  const vertices=parts.reduce((n,m)=>n+spec.accessors[m.primitives[0].attributes.POSITION].count,0);
  const indices=parts.reduce((n,m)=>n+spec.accessors[m.primitives[0].indices].count,0);
  const lowIndices=parts.reduce((n,m)=>n+spec.accessors[m.extras.lowIndices].count,0);
  const out={...spec.extras,position:new Float32Array(vertices*3),normal:new Float32Array(vertices*3),skinIndex:new Uint16Array(vertices*4),
    skinWeight:new Float32Array(vertices*4),uv:new Float32Array(vertices*2),coatLight:new Float32Array(vertices),
    index:new Uint16Array(indices),lowIndex:new Uint16Array(lowIndices)};
  let v=0,i=0,j=0;
  for(const part of parts){
    const {attributes,indices}=part.primitives[0];
    for(const [name,semantic,width,denom] of [["position","POSITION",3,1],["normal","NORMAL",3,127],["uv","TEXCOORD_0",2,65535],
      ["skinWeight","WEIGHTS_0",4,255],["skinIndex","JOINTS_0",4,1],["coatLight","_COATLIGHT",1,255]] as const){
      const src=typed(attributes[semantic],width),dst=out[name],start=v*width;
      if(denom===1)dst.set(src,start);
      else for(let k=0;k<src.length;k++)dst[start+k]=src[k]/denom;
    }
    for(const n of typed(indices,1))out.index[i++]=v+n;
    for(const n of typed(part.extras.lowIndices,1))out.lowIndex[j++]=v+n;
    v+=spec.accessors[attributes.POSITION].count;
  }
  return out;
}
