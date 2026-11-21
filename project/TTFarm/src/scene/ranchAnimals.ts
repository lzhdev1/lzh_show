import * as THREE from "three";
import { createProfessionalLibrary, isProfessionalSpecies } from "./professionalFauna";
import type {AnimalSpecies,AnimalElement} from "../game/ranch";
import type {AnimalAsset,AnimalJob} from "./ranchAnimalBake";
import {elementPaint,saddleHeight} from "./ranchSpecies";
import {isBird,ribsFor} from "./wildlifeAnatomy";
import {createMountRegalia} from "./mountRegalia";
import {makeElementInsignia} from "./elementInsignia";
export {saddleHeight,elementPaint} from "./ranchSpecies";

const coats=import.meta.glob("./animalMeshes/*.webp",{eager:true,query:"?url",import:"default"}) as Record<string,string>;
function materialize(asset:AnimalAsset,element:AnimalElement|null,texture:THREE.Texture){
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(asset.index,1));
  for(const [name,size] of [["position",3],["normal",3],["skinIndex",4],["skinWeight",4],["coatLight",1],["uv",2]] as const){
    geometry.setAttribute(name,new THREE.BufferAttribute(asset[name],size));
  }
  geometry.computeBoundingSphere();
  const distant=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(geometry.attributes))distant.setAttribute(name,attribute);
  distant.setIndex(new THREE.BufferAttribute(asset.lowIndex,1));distant.boundingSphere=geometry.boundingSphere;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.89});
  const insignia=element?makeElementInsignia(element):null;
  const eyeFinish=(source:string)=>source.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
    if(vMapUv.y<.036 && vMapUv.x>.866 && vMapUv.x<.94)roughnessFactor=.23;`);
  if(element){
    const paint=elementPaint[element];
    material.onBeforeCompile=shader=>{
      shader.uniforms.ranchInsignia={value:insignia};
      shader.uniforms.furLight={value:new THREE.Color(paint.light)};
      shader.uniforms.furCore={value:new THREE.Color(paint.core)};
      shader.uniforms.furDye={value:new THREE.Color(paint.fur)};
      shader.vertexShader="attribute float coatLight; varying float vCoatLight;\n"+shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nvCoatLight=coatLight;");
      shader.fragmentShader="uniform vec3 furLight,furCore,furDye; uniform sampler2D ranchInsignia; varying float vCoatLight;\n"+eyeFinish(shader.fragmentShader)
        .replace("#include <map_fragment>",`#include <map_fragment>
          float rune=clamp((1.-diffuseColor.a)*1.24,0.,1.);
          vec2 paper=(vec2(vMapUv.x,min(1.-vMapUv.y, .650-(1.-vMapUv.y)))-vec2(.20,.068))/vec2(.361,.162);
          vec4 crest=texture2D(ranchInsignia,clamp(vec2(1.-paper.x,1.-paper.y),0.,1.));
          crest.a*=step(0.,paper.x)*step(paper.x,1.)*step(0.,paper.y)*step(paper.y,1.);
          float value=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          float colourMask=smoothstep(.045,.29,value)*(1.-.7*smoothstep(.62,.95,value));
          if(vMapUv.y>.037){
            diffuseColor.rgb=mix(diffuseColor.rgb,furDye*(.46+.89*value),.45*colourMask);
            diffuseColor.rgb=mix(diffuseColor.rgb,mix(furLight,furCore,smoothstep(.12,.65,vMapUv.x)),rune);
          }
          diffuseColor.rgb=mix(diffuseColor.rgb,crest.rgb,crest.a*.91);
          if(vCoatLight>.01)diffuseColor.rgb=mix(furLight,furCore,smoothstep(.48,.58,vMapUv.x));
          diffuseColor.a=1.;`)
        .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
          float edgeGlow=pow(1.0-max(dot(normalize(normal),normalize(vViewPosition)),0.0),3.0);
          totalEmissiveRadiance+=furLight*edgeGlow*.19+diffuseColor.rgb*(vCoatLight*(.62+edgeGlow)+rune*.39)+crest.rgb*crest.a*.62;`);
    };
  }else material.onBeforeCompile=shader=>{shader.fragmentShader=eyeFinish(shader.fragmentShader);};
  return {geometry,distant,material,pivots:asset.pivots,parents:asset.parents,legBones:asset.legBones,wings:asset.wings??[],size:asset.size,
    dispose(){geometry.dispose();distant.dispose();insignia?.dispose();material.dispose();}};
}
type Model=ReturnType<typeof materialize>;
interface Coat {texture:THREE.Texture;ready:Promise<boolean>;refs:number}
interface Entry {key:string;job:AnimalJob;coat:Coat;refs:number;distance:number;model?:Model;ready:Promise<Model|null>;finish:(model:Model|null)=>void}

export function createAnimalLibrary(){
  const professional=createProfessionalLibrary();
  const templates=new Map<string,Entry>(),queue:Entry[]=[];
  const skins=new Map<AnimalSpecies,Coat>(),loader=new THREE.TextureLoader();
  function useCoat(species:AnimalSpecies){
    let item=skins.get(species);
    if(!item){
      let finish!:(loaded:boolean)=>void;const ready=new Promise<boolean>(res=>{finish=res;});
      const texture=loader.load(coats["./animalMeshes/"+species+".webp"],()=>finish(true),undefined,()=>finish(false));
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;item={texture,ready,refs:0};skins.set(species,item);
    }
    item.refs++;return item;
  }
  let worker:Worker|null=null,busy:Entry|null=null,closed=false;
  let useWorker=typeof Worker==="function";
  function complete(entry:Entry,asset:AnimalAsset|null){
    if(busy===entry)busy=null;
    if(!closed)queueMicrotask(pump);
    void entry.coat.ready.then(loaded=>{
      let model:Model|null=null;
      if(loaded&&asset&&!closed&&entry.refs>0){
        model=materialize(asset,entry.job.element,entry.coat.texture);entry.model=model;
      }
      entry.finish(model);
    });
  }
  async function fallback(entry:Entry){
    try{
      const {bakeAnimal}=await import("./ranchAnimalBake");
      complete(entry,await bakeAnimal(entry.job));
    }catch(error){console.error("Animal model could not be prepared",error);complete(entry,null);}
  }
  function recover(entry:Entry){
    worker?.terminate();worker=null;useWorker=false;
    // Older browsers without module workers still yield between individual animals.
    window.setTimeout(()=>void fallback(entry),0);
  }
  function pump(){
    if(busy||closed)return;
    queue.sort((a,b)=>a.distance-b.distance);
    const entry=queue.shift();if(!entry)return;
    if(entry.refs<1){entry.finish(null);queueMicrotask(pump);return;}
    busy=entry;
    if(useWorker){
      try{
        worker??=new Worker(new URL("./ranchAnimal.worker.ts",import.meta.url),{type:"module"});
        worker.onmessage=({data}:{data:AnimalAsset|null})=>data?complete(entry,data):recover(entry);
        worker.onerror=(event)=>{event.preventDefault();recover(entry);};
        worker.onmessageerror=()=>recover(entry);
        worker.postMessage(entry.job);
      }catch{recover(entry);}
    }else window.setTimeout(()=>void fallback(entry),0);
  }
  function create(species:AnimalSpecies,element:AnimalElement|null,saddled=false){
    if(isProfessionalSpecies(species))return professional.create(species,element,saddled);
    const key=species+"/"+element+"/"+saddled;
    let existing=templates.get(key);
    if(!existing){
      let finish!:(model:Model|null)=>void;
      const ready=new Promise<Model|null>(resolve=>{finish=resolve;});
      existing={key,job:{species,element,saddled},coat:useCoat(species),refs:0,distance:saddled?0:Infinity,ready,finish};
      templates.set(key,existing);queue.push(existing);queueMicrotask(pump);
    }
    const entry=existing;entry.refs++;
    const group=new THREE.Group(),regalia=createMountRegalia(species,element,saddled);
    const avian=isBird(species);
    let mesh:THREE.SkinnedMesh|null=null,skeleton:THREE.Skeleton|null=null,bones:THREE.Bone[]=[];
    let disposed=false,lastDistance=saddled?0:Infinity;
    const ready=entry.ready.then(model=>{
      if(disposed||closed||!model)return;
      mesh=new THREE.SkinnedMesh(lastDistance>22**2?model.distant:model.geometry,model.material);
      bones=model.pivots.map(()=>new THREE.Bone());
      model.pivots.forEach((pivot,i)=>{
        const parent=model.parents[i],bone=bones[i];bone.position.set(...pivot);
        if(parent<0)mesh!.add(bone);
        else {bone.position.sub(new THREE.Vector3(...model.pivots[parent]));bones[parent].add(bone);}
      });
      skeleton=new THREE.Skeleton(bones);mesh.bind(skeleton);
      mesh.scale.setScalar(model.size);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
      if(element){
        const skull=ribsFor(species)[18],pivot=model.pivots[1];
        regalia.head.position.set(0,skull.y+skull.d*.68-pivot[1],skull.z-pivot[2]);
        regalia.head.scale.setScalar(1/model.size);bones[1].add(regalia.head);
      }
      if(saddled){
        regalia.back.position.y=saddleHeight(species)/model.size;
        regalia.back.scale.setScalar(1/model.size);bones[0].add(regalia.back);
      }
    });
    return {group,ready,get seatHeight(){return saddleHeight(species);},
      animate(time:number,phase:number,stride:number,distanceSquared=0){
        lastDistance=distanceSquared;
        if(!mesh||!entry.model){entry.distance=Math.min(entry.distance,distanceSquared);return;}
        mesh.geometry=distanceSquared>22**2?entry.model.distant:entry.model.geometry;
        bones[0].position.y=.010*Math.cos(phase*2)*stride+.004*Math.sin(time*2.2);
        bones[1].rotation.x=.035*Math.sin(time*1.48)+.035*stride*Math.sin(phase*2);
        bones[1].rotation.y=.060*Math.sin(time*.88);bones[2].rotation.y=.19*Math.sin(time*2.5+phase*.18);
        entry.model.legBones.forEach((id,i)=>{
          const lead=avian?i*Math.PI:[0,Math.PI*.84,Math.PI,Math.PI*1.84][i];
          const angle=phase+lead,forward=Math.sin(angle),lift=Math.max(0,Math.cos(angle)),hind=!avian&&i%2===0;
          bones[id].rotation.x=forward*stride*(avian?.43:.48);
          bones[id+1].rotation.x=lift*stride*(avian?-.34:hind?.36:-.35);
          bones[id+2].rotation.x=lift*stride*(avian?.26:hind?-.24:.22);
        });
        entry.model.wings.forEach((id,i)=>{
          const side=i===0?-1:1;
          bones[id].rotation.z=side*(.029*Math.sin(time*2.2)+.10*stride*Math.cos(phase));
          bones[id].rotation.x=.016*Math.sin(time*1.9+i);
        });
      },
      dispose(){
        if(disposed)return;
        disposed=true;regalia.dispose();skeleton?.dispose();group.clear();
        if(--entry.refs===0){
          entry.model?.dispose();entry.model=undefined;
          if(--entry.coat.refs===0){entry.coat.texture.dispose();skins.delete(species);}
          if(templates.get(key)===entry)templates.delete(key);
        }
      },
    };
  }
  return {create,dispose(){
    professional.dispose();
    closed=true;worker?.terminate();worker=null;
    for(const entry of templates.values()){entry.model?.dispose();entry.model=undefined;entry.finish(null);}
    for(const item of skins.values())item.texture.dispose();skins.clear();
    queue.splice(0).forEach(entry=>entry.finish(null));busy?.finish(null);busy=null;templates.clear();
  }};
}
