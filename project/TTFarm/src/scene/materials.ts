import * as THREE from "three";

/**
 * 场景材质：QQ 农场那种卡通软塑料感。
 * 色块饱和、表面略哑、靠形体与柔光出效果，不贴照片纹理。
 * 想换配色只改这里的色值即可，整套场景会跟着变。
 */
export const PALETTE = {
  grass: 0x8ed15c,
  grassLight: 0xa7e072,
  grassDark: 0x7cc14e,
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
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * 卡通材质：同一组颜色 + 参数复用同一个实例，避免重复对象和重复上传。
 * roughness 默认给 0.85 —— 太光滑会像塑料玩具，粗糙一点更接近游戏里的手绘色块。
 */
export function clay(color: number, options: ClayOptions = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, options]);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    envMapIntensity: 0.45,
  });
  materialCache.set(key, mat);
  return mat;
}

export function disposeClayMaterials(): void {
  materialCache.forEach((mat) => mat.dispose());
  materialCache.clear();
}
