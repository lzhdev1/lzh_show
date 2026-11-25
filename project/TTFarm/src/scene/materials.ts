import * as THREE from "three";

/**
 * 场景材质：QQ 农场那种卡通软塑料感。
 * 色块饱和、表面略哑、靠形体与柔光出效果，不贴照片纹理。
 * 想换配色只改这里的色值即可，整套场景会跟着变。
 */
export const PALETTE = {
  grass: 0x98bc77,
  grassLight: 0xb4c986,
  grassDark: 0x87ad72,
  soil: 0xa9744a,
  soilWet: 0x85583a,
  soilGrass: 0x93c466,
  wood: 0xe0ab6d,
  woodDark: 0xba8149,
  plank: 0xf0c98a,
  barnRed: 0xd2604a,
  roofRed: 0xbf4f3c,
  cream: 0xfff3d6,
  stone: 0xd8d3c6,
  water: 0x63b9d6,
  leaf: 0x74bb4b,
  leafLight: 0x93d466,
  leafDark: 0x5aa63d,
  flowerPink: 0xff9db8,
  flowerYellow: 0xffd34d,
  // 远山：比草地深一号的青绿，尖顶 + flatShading 的棱面才立得住
  mountain: 0x819a99,
  mountainDark: 0x6b8e84,
} as const;

export interface ClayOptions {
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  emissive?: number;
  emissiveIntensity?: number;
  clearcoat?: number;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * 软胶/乙烯基卡通材质（海岛乐园式柔和）：平滑法线 + 柔和高光 + 少量 clearcoat。
 * 同一组颜色 + 参数复用同一个实例，避免重复对象和重复上传。
 * roughness 默认 0.55 —— 保留一点哑光但带柔柔的乙烯基高光，不再硬塑料块。
 */
export function clay(color: number, options: ClayOptions = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, options]);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    clearcoat: options.clearcoat ?? 0.2,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.45,
  });
  materialCache.set(key, mat);
  return mat;
}

/** 顶点色网格共用的软胶材质：平滑法线 + 柔和高光 + 双面 */
export function softVertexMaterial(side: THREE.Side = THREE.FrontSide): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, flatShading: false, roughness: 0.45, metalness: 0,
    clearcoat: 0.2, clearcoatRoughness: 0.55, side,
  });
}

export function disposeClayMaterials(): void {
  materialCache.forEach((mat) => mat.dispose());
  materialCache.clear();
}
