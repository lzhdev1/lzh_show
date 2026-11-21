import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MUTATIONS, type Spirit } from "../game/weather";
import { addDollCostume } from "./dolls/costumes";
import { addDollFace, createDollAtlas } from "./dolls/face";
import type { DollAdd, V } from "./dolls/geometry";
import { addDollHair } from "./dolls/hair";

// A shallow calyx grounds the figurine in the soil. Its upper leaves curl up
// around the heels, leaving the shoes and the character's silhouette visible.
function addCalyx(id: Spirit, add: DollAdd) {
  const profile = [[.02, -.034], [.14, -.014], [.205, .004], [.137, .012], [.02, .012]];
  const segments = 48;
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const petal = (.5 + .5 * Math.cos(6 * Math.atan2(x, z))) ** 2;
    const edge = Math.hypot(x, z) / .205;
    const swell = 1 + edge * (.58 * petal - .1);
    pos.setXYZ(i, x * swell, pos.getY(i) + .022 * petal * edge ** 2, z * swell);
  }
  geo.computeVertexNormals();
  add(geo, MUTATIONS[id].leaf);
}

export function createCropSpiritGeometry(id: Spirit) {
  const pieces: THREE.BufferGeometry[] = [];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const zero: V = [0, 0, 0];
  const unit: V = [1, 1, 1];
  const add: DollAdd = (geo, color, position, rotation, scale) => {
    if (!geo.hasAttribute("normal")) geo.computeVertexNormals();
    if (position || rotation || scale) {
      transform.position.set(...(position ?? zero));
      transform.rotation.set(...(rotation ?? zero));
      transform.scale.set(...(scale ?? unit));
      transform.updateMatrix();
      geo.applyMatrix4(transform.matrix);
    }

    const count = geo.getAttribute("position").count;
    if (!geo.index) geo.setIndex(Array.from({ length: count }, (_, i) => i));
    if (!geo.userData.dollAtlas) {
      // All unpainted pieces use the same opaque white texel on the face atlas.
      geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2).fill(1 / 64), 2));
    }
    const pigment = geo.getAttribute("color");
    const rgb = new Float32Array(count * 3);
    tint.setHex(color);
    for (let i = 0; i < count; i++) {
      rgb[3 * i] = tint.r * (pigment?.getX(i) ?? 1);
      rgb[3 * i + 1] = tint.g * (pigment?.getY(i) ?? 1);
      rgb[3 * i + 2] = tint.b * (pigment?.getZ(i) ?? 1);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    pieces.push(geo);
  };
  addCalyx(id, add);
  addDollCostume(id, add);
  addDollFace(id, add);
  addDollHair(id, add);
  const model = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  return model;
}

export function createCropSpiritMaterial(id: Spirit) {
  return new THREE.MeshStandardMaterial({
    map: createDollAtlas(id),
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: .74,
  });
}
