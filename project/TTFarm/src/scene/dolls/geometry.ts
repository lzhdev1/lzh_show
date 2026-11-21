import * as THREE from "three";

export type V = [number, number, number];
export type DollAdd = (
  geometry: THREE.BufferGeometry,
  color: number,
  position?: V,
  rotation?: V,
  scale?: V,
) => void;
