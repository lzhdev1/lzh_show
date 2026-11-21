import {bakeAnimal,type AnimalJob} from "./ranchAnimalBake";

self.onmessage=async({data}:{data:AnimalJob})=>{
  try{
    const asset=await bakeAnimal(data);
    const buffers=[asset.index,asset.lowIndex,asset.position,asset.normal,asset.uv,asset.skinIndex,asset.skinWeight,asset.coatLight];
    self.postMessage(asset,{transfer:buffers.map(view=>view.buffer)});
  }catch{self.postMessage(null);}
};
