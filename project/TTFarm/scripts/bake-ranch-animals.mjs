// Run inside the project container: node scripts/bake-ranch-animals.mjs
// Each original species has a continuous skin. Moveable regalia are created in mountRegalia.ts.
import {mkdir,writeFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import {createServer} from "vite";
import {createRequire} from "node:module";
const vite=await createServer({configFile:false,server:{middlewareMode:true},optimizeDeps:{noDiscovery:true}});
try{
  const {buildShape}=await vite.ssrLoadModule("/src/scene/ranchAnimalShape.ts");
  const {LOCAL_WILDLIFE}=await vite.ssrLoadModule("/src/scene/wildlifeAnatomy.ts");
  const target=new URL("../src/scene/animalMeshes/",import.meta.url);
  await mkdir(target,{recursive:true});
  // Optional offline canvas adapter. In the container, npm install --prefix /tmp/ttfarm-art @napi-rs/canvas
  // then pass --canvas=/tmp/ttfarm-art/node_modules/@napi-rs/canvas to also export the six coat atlases.
  const canvasPath=process.argv.find(a=>a.startsWith("--canvas="))?.slice(9);
  if(canvasPath)globalThis.OffscreenCanvas=createRequire(import.meta.url)(canvasPath).Canvas;
  const paint=canvasPath?(await vite.ssrLoadModule("/src/scene/ranchCoat.ts")).paintAnimal:null;
  for(const species of LOCAL_WILDLIFE){
    if(paint){
      const canvas=paint(species);
      await writeFile(new URL(species+".webp",target),await canvas.encode("webp",92));
    }
    const info={asset:{version:"2.0",generator:"TT Farm character sculpt"},extensionsUsed:["KHR_mesh_quantization"],extensionsRequired:["KHR_mesh_quantization"],scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};
    const chunks=[];let bytes=0;
    const types=new Map([[Float32Array,5126],[Uint16Array,5123],[Uint8Array,5121],[Int8Array,5120]]);
    function accessor(array,width,normalized=false,bounds=false,target=0){
      const pad=(4-bytes%4)%4;if(pad){chunks.push(Buffer.alloc(pad));bytes+=pad;}
      const bufferView=info.bufferViews.length;
      let buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
      const packed=width*array.BYTES_PER_ELEMENT,byteStride=Math.ceil(packed/4)*4;
      const view={buffer:0,byteOffset:bytes,byteLength:buffer.length};
      if(target)view.target=target;
      if(target===34962&&byteStride!==packed){
        const padded=Buffer.alloc(array.length/width*byteStride);
        for(let i=0;i<array.length/width;i++)buffer.copy(padded,i*byteStride,i*packed,(i+1)*packed);
        buffer=padded;view.byteStride=byteStride;view.byteLength=padded.length;
      }
      info.bufferViews.push(view);
      chunks.push(buffer);bytes+=buffer.length;
      const a={bufferView,componentType:types.get(array.constructor),count:array.length/width,type:width===16?"MAT4":["","SCALAR","VEC2","VEC3","VEC4"][width]};
      if(normalized)a.normalized=true;
      if(bounds){a.min=Array(width).fill(Infinity);a.max=Array(width).fill(-Infinity);for(let i=0;i<array.length;i++){const j=i%width;a.min[j]=Math.min(a.min[j],array[i]);a.max[j]=Math.max(a.max[j],array[i]);}}
      return info.accessors.push(a)-1;
    }
    {
      const {geometry,pivots,parents,legBones,wings,size}=buildShape(species);
      const attrs={};
      for(const [key,semantic] of [["position","POSITION"],["normal","NORMAL"],["uv","TEXCOORD_0"],["skinWeight","WEIGHTS_0"],["skinIndex","JOINTS_0"],["coatLight","_COATLIGHT"]]){
        const attr=geometry.getAttribute(key);let array=attr.array,normalized=false;
        if(key==="normal"){array=Int8Array.from(array,v=>Math.round(v*127));normalized=true;}
        if(key==="position")array=Float32Array.from(array,v=>Math.round(v*2048)/2048);
        if(key==="uv"){array=Uint16Array.from(array,v=>Math.round(v*65535));normalized=true;}
        if(key==="skinWeight"||key==="coatLight"){array=Uint8Array.from(array,v=>Math.round(v*255));normalized=true;}
        if(key==="skinWeight")for(let i=0;i<array.length;i+=4){
          const total=array[i]+array[i+1]+array[i+2]+array[i+3];
          let largest=i;for(let j=1;j<4;j++)if(array[i+j]>array[largest])largest=i+j;
          array[largest]+=255-total;
        }
        if(key==="skinIndex")array=Uint8Array.from(array);
        attrs[semantic]=accessor(array,attr.itemSize,normalized,key==="position",34962);
      }
      const indices=accessor(geometry.index.array,1,false,false,34963);
      const lowIndices=accessor(geometry.userData.lowIndex,1,false,false,34963);
      const mesh=info.meshes.push({name:"body",primitives:[{attributes:attrs,indices}],extras:{lowIndices}})-1;
      info.nodes.push({name:"body",mesh,skin:0});
      info.extras={pivots,parents,legBones,wings,size};
      geometry.dispose();
    }
    // The generic glTF view shows the neutral body; the game selects its desired attachments.
    const {pivots,parents}=info.extras,firstBone=info.nodes.length;
    const joints=pivots.map((p,i)=>{
      const parent=parents[i],translation=p.map((n,k)=>n-(parent>=0?pivots[parent][k]:0));
      const children=parents.flatMap((n,j)=>n===i?[firstBone+j]:[]);
      info.nodes.push({name:"joint-"+i,translation,...children.length?{children}:{}});
      return firstBone+i;
    });
    const inverse=Float32Array.from(pivots.flatMap(([x,y,z])=>[1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1]));
    info.skins=[{joints,skeleton:firstBone,inverseBindMatrices:accessor(inverse,16)}];
    info.scenes[0].nodes.push(firstBone);info.buffers[0].byteLength=bytes;
    const bin=Buffer.concat(chunks),json=Buffer.from(JSON.stringify(info));
    const jlen=Math.ceil(json.length/4)*4,blen=Math.ceil(bin.length/4)*4,blob=Buffer.alloc(28+jlen+blen);
    blob.writeUInt32LE(0x46546c67,0);blob.writeUInt32LE(2,4);blob.writeUInt32LE(blob.length,8);
    blob.writeUInt32LE(jlen,12);blob.writeUInt32LE(0x4e4f534a,16);blob.fill(32,20,20+jlen);json.copy(blob,20);
    blob.writeUInt32LE(blen,20+jlen);blob.writeUInt32LE(0x004e4942,24+jlen);bin.copy(blob,28+jlen);
    const archive=gzipSync(blob,{level:9});await writeFile(new URL(species+".glb.gz",target),archive);
    console.log(species,Math.round(archive.length/1024)+" KiB");
  }
}finally{await vite.close();}
