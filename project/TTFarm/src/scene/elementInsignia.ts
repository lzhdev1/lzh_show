import * as THREE from "three";
import type { AnimalElement } from "../game/ranch";

// Each crest is drawn once. Its UVs are painted in the rest pose so the marks
// follow the animal's muscles when its skeleton changes pose.
const crests: Record<AnimalElement, { color: string; pearl: string; paths: string[]; gems: number[][] }> = {
  metal: {
    color:"#ffae46", pearl:"#fff3b5",
    paths:["M16 93 Q74 94 119 62 L95 65 Q128 50 156 29 L145 54 L175 42 Q158 60 128 74 L143 74 Q86 105 41 104",
      "M78 112 Q127 102 157 79 L148 91 L174 81 M170 61 L188 37 L183 56 L204 42 L186 65 L195 63 L174 80",
      "M33 85 Q65 78 91 63 M158 102 Q188 86 212 66"],
    gems:[[197,32,7],[216,49,4],[65,112,3]]
  },
  wood: {
    color:"#48df9d", pearl:"#f7ffd1",
    paths:["M20 107 C69 111 55 82 88 82 S141 110 177 41 Q188 25 209 20",
      "M58 98 Q49 82 31 80 Q38 97 58 98 M88 82 Q82 60 62 58 Q65 76 88 82 M112 83 Q121 103 143 99 Q135 85 112 83",
      "M137 76 Q139 52 120 48 Q119 66 137 76 M162 59 Q186 67 201 48 Q177 46 162 59 M179 37 Q179 19 165 14 Q160 29 179 37",
      "M53 113 Q74 116 91 105 M196 34 Q208 36 217 29"],
    gems:[[108,61,4],[204,17,5],[148,102,3]]
  },
  water: {
    color:"#4ddced", pearl:"#ede6ff",
    paths:["M14 90 C47 119 93 81 111 56 C134 25 165 30 163 52 C160 37 141 45 140 58 C139 73 167 74 186 57 Q207 43 226 48",
      "M22 105 C61 123 90 100 115 80 C141 59 145 95 182 77 Q197 69 210 69",
      "M40 80 C65 86 82 68 93 51 Q107 27 125 25 M122 99 Q151 109 174 94",
      "M175 33 Q177 20 190 16 Q192 29 175 33"],
    gems:[[196,31,5],[94,100,3],[210,60,3]]
  },
  fire: {
    color:"#ff8252", pearl:"#fff4a8",
    paths:["M19 99 C51 111 61 84 97 79 Q85 80 74 73 C106 75 120 54 126 34 Q133 51 123 67 C152 64 162 44 161 21 C181 44 163 64 157 70 Q181 65 198 46 Q192 82 154 87 Q173 88 183 82 Q159 109 114 101 Q134 96 141 88 Q118 86 98 96 C73 111 54 118 26 110",
      "M50 85 Q57 67 80 58 Q73 76 50 85 M184 40 Q186 22 205 13 Q207 32 184 40",
      "M82 115 Q100 116 113 109"],
    gems:[[215,45,4],[146,22,4],[66,109,2]]
  },
  earth: {
    color:"#eea260", pearl:"#eee1ff",
    paths:["M17 103 L58 91 L85 62 L93 74 L133 26 L146 61 L157 51 L176 75 L194 59 L217 77",
      "M72 89 L86 70 L83 84 L96 78 M110 61 L133 35 L128 62 L139 55 L147 67",
      "M39 109 L77 101 L100 85 L109 91 L147 71 L161 80 L181 73 M77 113 L99 104 L113 104 L146 90",
      "M164 44 L167 31 L177 23 L175 37 Z"],
    gems:[[191,43,7],[204,55,3],[59,95,3]]
  }
};

export function makeElementInsignia(element: AnimalElement) {
  const canvas=document.createElement("canvas");
  canvas.width=512; canvas.height=288;
  const ctx=canvas.getContext("2d")!;
  ctx.scale(2,2);
  const {color,pearl,paths,gems}=crests[element];
  const pattern=new Path2D(paths.join(" "));
  for (const [x,y,r] of gems) {
    pattern.moveTo(x,y-r);pattern.quadraticCurveTo(x+r*.14,y-r*.14,x+r*.70,y);
    pattern.quadraticCurveTo(x+r*.14,y+r*.14,x,y+r);
    pattern.quadraticCurveTo(x-r*.14,y+r*.14,x-r*.70,y);
    pattern.quadraticCurveTo(x-r*.14,y-r*.14,x,y-r);
  }
  ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.strokeStyle=color; ctx.lineWidth=3; ctx.shadowColor=color; ctx.shadowBlur=8;
  ctx.stroke(pattern);
  ctx.shadowBlur=0; ctx.lineWidth=1.15; ctx.strokeStyle=pearl; ctx.stroke(pattern);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
