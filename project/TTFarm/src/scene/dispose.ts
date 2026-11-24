import * as THREE from "three";

/** 释放一棵临时挂在 scene 上的对象树；world/plot 等长期资源仍由各自 owner 管理。 */
export function disposeObject3D(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((node) => {
    if (node instanceof THREE.InstancedMesh) node.dispose();
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line)) return;
    geometries.add(node.geometry);
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  root.clear();
}
