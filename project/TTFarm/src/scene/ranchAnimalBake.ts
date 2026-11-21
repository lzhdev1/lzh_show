import type {AnimalElement,AnimalSpecies} from "../game/ranch";
import type {Point} from "./ranchSculpt";
import {loadSculpt} from "./ranchAnimalAssets";

export interface AnimalJob {species:AnimalSpecies;element:AnimalElement|null;saddled:boolean}
export interface AnimalAsset {
  index:Uint16Array|Uint32Array;lowIndex:Uint16Array;position:Float32Array;normal:Float32Array;
  uv:Float32Array;skinIndex:Uint16Array;skinWeight:Float32Array;coatLight:Float32Array;
  pivots:Point[];parents:number[];legBones:number[];wings?:number[];size:number;
}
export const bakeAnimal=(job:AnimalJob):Promise<AnimalAsset>=>loadSculpt(job.species,job.element,job.saddled);
