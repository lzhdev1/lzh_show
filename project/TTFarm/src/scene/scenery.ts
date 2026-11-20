import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Fold the painted pieces of a static prop into a single vertex-coloured surface.
 * Keep the root transform so the same local geometry can be instanced elsewhere.
 */
export function bakeScenery(root: THREE.Group): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  root.updateMatrixWorld(true);
  const toLocal = root.matrixWorld.clone().invert();
  const transform = new THREE.Matrix4();
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const material = node.material as THREE.MeshStandardMaterial;
    const source = node.geometry;
    const geo = source.index ? source.toNonIndexed() : source.clone();
    transform.multiplyMatrices(toLocal, node.matrixWorld);
    geo.applyMatrix4(transform);
    // All the source materials here use solid colour, so no UV stream is needed.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "color") geo.deleteAttribute(name);
    }
    const vertexColors = geo.getAttribute("color");
    const colors = new Float32Array(geo.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length / 3; i++) {
      color.copy(material.color);
      if (vertexColors) {
        color.r *= vertexColors.getX(i);
        color.g *= vertexColors.getY(i);
        color.b *= vertexColors.getZ(i);
      }
      color.toArray(colors, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geo);
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, paintedMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(root.position);
  mesh.quaternion.copy(root.quaternion);
  mesh.scale.copy(root.scale);
  return mesh;
}

const paintedMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.91,
  envMapIntensity: 0.25,
});
