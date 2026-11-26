import type { AnimalSpecies, AnimalElement } from "../game/ranch";


interface Body {
  width: number; belly: number; length: number; leg: number; neck: number; face: number;
}
const hound: Body = {width:.34, belly:.34, length:.64, leg:.48, neck:.25, face:.30};
const cat: Body = {...hound,width:.38,belly:.37,face:.35};
const round: Body = {width:.48,belly:.48,length:.55,leg:.34,neck:.18,face:.38};
const ungulate: Body = {width:.31,belly:.34,length:.57,leg:.61,neck:.38,face:.28};
interface SpeciesStyle {
  body: Body; size: number; fur: number; bib: number; pattern: number;
}
function style(body: Body,size: number,fur: number,bib: number,pattern: number): SpeciesStyle {
  return {body,size,fur,bib,pattern};
}
export const styles: Record<AnimalSpecies,SpeciesStyle> = {
  wolf:style(hound,1.25,0x75889a,0xf2ede1,0x47586f),
  bear:style(round,1.36,0x936246,0xebcfa1,0x67432f),
  tiger:style(cat,1.30,0xf4a14e,0xffebc2,0x543b35),
  lion:style(cat,1.32,0xe1ae62,0xffde9c,0x96542d),
  elephant:style({...round,width:.53,belly:.48,length:.70,leg:.62,face:.43},1.57,0x97a4bb,0xd5b9be,0x626f91),
  panda:style({width:.341,belly:.269,length:.776,leg:.415,neck:.202,face:.249},1.38,0xe2dcc7,0xf2e7d1,0x282d33),
  fox:style(hound,.83,0xc9703c,0xffe7bd,0x613c37),
  rabbit:style({...round,length:.42,leg:.16,face:.33},.67,0xe7c1aa,0xffefe0,0xc28682),
  deer:style(ungulate,1.02,0xb98052,0xf3d9ac,0x725039),
  boar:style({...round,length:.63,leg:.29},.94,0x97725c,0xcfaba1,0x5c463f),
  goat:style(ungulate,.89,0xc8b6a3,0xf3e7d4,0x766258),
  alpaca:style({width:.225,belly:.217,length:.532,leg:.61,neck:.72,face:.142},1.06,0xc3a580,0xf7edda,0x705748),
  sheep:style({...round,width:.43,leg:.33},.88,0xf3e4c3,0xfff2d7,0x806457),
  horse:style({...ungulate,neck:.53,leg:.70,length:.69},1.14,0xab6a48,0xeed2ad,0x533f41),
  flameHorse:style({...ungulate,neck:.53,leg:.70,length:.69},1.16,0x141013,0xff6a22,0x2a1116),
  cow:style({...ungulate,width:.46,belly:.43,length:.66},1.12,0xf4e7d1,0xf2c4be,0x5b4c48),
  raccoon:style({width:.16,belly:.148,length:.435,leg:.24,neck:.089,face:.124},1.11,0x898376,0xd4c9af,0x373738),
  redPanda:style({width:.189,belly:.169,length:.461,leg:.24,neck:.115,face:.139},1.12,0xb45132,0xf1dfbd,0x463633),
  penguin:style({width:.145,belly:.16,length:.18,leg:.09,neck:.13,face:.115},1.20,0x293641,0xf4ecda,0x1b222b),
  duck:style({width:.126,belly:.111,length:.255,leg:.102,neck:.151,face:.079},1.16,0x94856f,0xe8ddc3,0x35584a),
  crane:style({width:.148,belly:.14,length:.36,leg:.548,neck:.44,face:.087},1.24,0xe4e1d6,0xf3f1e8,0x303740),
};

export const elementPaint: Record<AnimalElement,{fur:number;shade:number;light:number;core:number}> = {
  metal:{fur:0xcba85c,shade:0x766389,light:0xffce61,core:0xfff4cb},
  wood:{fur:0x579a7f,shade:0x354f68,light:0x8affab,core:0xffb6cc},
  water:{fur:0x539cc0,shade:0x4a5a9a,light:0x73eeff,core:0xcac3ff},
  fire:{fur:0xb65a64,shade:0x633a66,light:0xff9757,core:0xffed8b},
  earth:{fur:0xb78074,shade:0x61597c,light:0xffbb77,core:0xcdb2ff},
};
export function backHeight(body: Body) { return body.leg + body.belly * 1.70; }
const importedHeights:Partial<Record<AnimalSpecies,number>> = {
  wolf:1.08,bear:1.25,tiger:1.14,lion:1.19,elephant:1.80,
  fox:.48,rabbit:.29,deer:.98,boar:.65,goat:.73,sheep:.65,horse:1.30,flameHorse:1.30,cow:1.04,
};
export function saddleHeight(species: AnimalSpecies) {
  if(importedHeights[species]!==undefined)return importedHeights[species]!;
  const {body,size} = styles[species];
  return (body.leg + body.belly*1.79 + .050) * size;
}
