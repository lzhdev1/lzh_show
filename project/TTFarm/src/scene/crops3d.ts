import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CROPS, type CropId } from "../game/crops";
import { MUTATIONS, type Mutation } from "../game/weather";

type Point = [number, number, number];
const TAU = Math.PI * 2;

// 中脉有窄窄的浅色脊，叶缘有自然扭转。小萼片只需要三个横截面。
function foldedLeaf(length: number, width: number, height: number, tip: number, ruffled = false): THREE.BufferGeometry {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = length < 0.13 ? 3 : 8;
  const lanes = length < 0.13 ? [-1, 0, 1] : [-1, -0.12, 0, 0.12, 1];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const arc = Math.sin(t * Math.PI);
    const swell = arc ** (ruffled ? 0.57 : 0.85);
    const scallop = ruffled ? 1 + 0.16 * Math.cos(t * Math.PI * 7) : 1;
    const edge = Math.max(0.004, swell) * width * scallop;
    const curl = height * arc + tip * t;
    for (let j = 0; j < lanes.length; j++) {
      const u = lanes[j], rim = Math.abs(u);
      const lateral = width * 0.16 * Math.sin(t * Math.PI * 1.6);
      const fold = (1 - rim) * swell * width * 0.42;
      const ripple = u * (t - 0.4) * swell * width * 0.48;
      vertices.push(lateral + u * edge, curl + fold + ripple, (t + 0.065 * rim * arc) * length);
      const tone = 0.82 + 0.22 * t + 0.1 * u;
      if (u === 0) colors.push(1.28, 1.17, 0.83);
      else colors.push(tone * (1 + t * 0.12), tone, tone * (1.15 - 0.22 * t));
      if (i < rows && j + 1 < lanes.length) {
        const k = i * lanes.length + j;
        indices.push(k, k + lanes.length, k + 1, k + 1, k + lanes.length, k + lanes.length + 1);
      }
    }
  }
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  leaf.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  leaf.setIndex(indices);
  leaf.computeVertexNormals();
  return leaf;
}

/** 每个品种、阶段与变异只建一次几何体，四株共用一个实例化批次。 */
function growModel(crop: CropId, stage: number, mutation: Mutation | null): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const variant = mutation ? MUTATIONS[mutation] : null;
  const leaf = variant?.leaf ?? CROPS[crop].leaf;
  const body = variant?.fruit ?? CROPS[crop].body;

  function add(geo: THREE.BufferGeometry, color: number, pos: Point, rot: Point = [0, 0, 0], scale: Point = [1, 1, 1]) {
    transform.position.set(...pos);
    transform.rotation.set(...rot);
    transform.scale.set(...scale);
    transform.updateMatrix();
    geo.applyMatrix4(transform.matrix);
    geo.deleteAttribute("uv");
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (flat !== geo) geo.dispose();
    const positions = flat.getAttribute("position");
    const normals = flat.getAttribute("normal");
    const pigment = flat.getAttribute("color");
    const rgb = new Float32Array(positions.count * 3);
    tint.setHex(color);
    for (let i = 0; i < positions.count; i++) {
      const light = 0.91 + 0.08 * normals.getY(i) + 0.05 * positions.getY(i);
      rgb[i * 3] = tint.r * light * (pigment?.getX(i) ?? 1);
      rgb[i * 3 + 1] = tint.g * light * (pigment?.getY(i) ?? 1);
      rgb[i * 3 + 2] = tint.b * light * (pigment?.getZ(i) ?? 1);
    }
    flat.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    pieces.push(flat);
  }
  function orb(color: number, pos: Point, scale: Point) {
    add(new THREE.SphereGeometry(1, 12, 8), color, pos, [0, 0, 0], scale);
  }
  function leaves(count: number, y: number, length: number, width: number, lift: number, tip: number, angle = 0, spread = 0, base = leaf) {
    const ruffled = crop === "cabbage" || crop === "radish" || crop === "strawberry";
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count + angle + 0.055 * Math.sin(2.3 * i);
      const color = tint.setHex(base).offsetHSL(Math.sin(i) * 0.012, 0, 0.035 * Math.cos(i * 2.6)).getHex();
      add(foldedLeaf(length * (0.93 + i % 3 * 0.07), width, lift, tip, ruffled), color,
        [Math.sin(a) * spread, y, Math.cos(a) * spread], [0.13 * Math.sin(i * 1.2), a, 0.12 * Math.cos(i)]);
    }
  }
  function stem(pos: Point, h: number, width: number, angle = 0, color = leaf) {
    add(new THREE.CylinderGeometry(width * 0.7, width, h, 6), color, pos, [0, 0, angle]);
  }

  if (stage === 0) {
    orb(0x9c6a47, [0, 0.025, 0], [0.17, 0.065, 0.14]);
    add(new THREE.SphereGeometry(1, 8, 5), 0xe5c493, [0, 0.074, 0], [0, 0, 0.35], [0.035, 0.047, 0.03]);
  } else if (stage === 1) {
    stem([0, 0.094, 0], 0.19, 0.023);
    leaves(2, 0.16, 0.21, 0.083, 0.07, 0.035, 0.6);
    leaves(2, 0.19, 0.105, 0.048, 0.045, 0.08, 2);
  } else {
    const ripe = stage === 3;
    switch (crop) {
      case "radish": {
        // 车削轮廓保留圆肩和收尖的根须。
        const size = ripe ? 1 : 0.68;
        const profile = [[0.006, 0], [0.043, 0.08], [0.17, 0.17], [0.24, 0.32], [0.19, 0.41], [0.055, 0.44]];
        add(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 14), body, [0, -0.04, 0], [0, 0, 0.08], [size, size, size]);
        leaves(7, 0.39 * size, 0.32, 0.093, 0.22, 0.13, 0.4);
        leaves(4, 0.4 * size, 0.16, 0.066, 0.19, 0.29, 0.9);
        break;
      }
      case "cabbage":
        orb(body, [0, ripe ? 0.26 : 0.17, 0], ripe ? [0.31, 0.29, 0.31] : [0.2, 0.18, 0.2]);
        leaves(7, 0.06, 0.47, 0.19, 0.18, 0.12, 0.3);
        leaves(6, 0.12, 0.34, 0.16, 0.23, 0.28, 0.8, 0, tint.setHex(leaf).lerp(new THREE.Color(body), 0.42).getHex());
        leaves(5, 0.17, 0.23, 0.13, 0.17, ripe ? 0.36 : 0.21, 0.4, 0, body);
        break;
      case "tomato":
        stem([0, 0.55, 0], 1.1, 0.035, -0.035);
        stem([0.09, 0.52, -0.07], 1.07, 0.029, 0.055, 0xb79863);
        for (let j = 0; j < 3; j++) leaves(3, 0.34 + j * 0.25, 0.34 - j * 0.035, 0.095, 0.08, -0.045, j);
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4;
          const x = 0.21 * Math.cos(a), z = 0.21 * Math.sin(a), y = 0.42 + (i % 2) * 0.21;
          const r = ripe ? 0.147 : 0.08;
          const drop = 0.095;
          const direction = new THREE.Vector3(x, -drop, z);
          const truss = new THREE.CylinderGeometry(0.012, 0.02, direction.length(), 5);
          truss.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
          add(truss, leaf, [x * 0.5, y + r + drop * 0.5, z * 0.5]);
          orb(ripe ? body : 0xa5c665, [x, y, z], [r, r * 0.93, r]);
          for (let k = 0; k < 5; k++) add(foldedLeaf(r * 0.73, 0.027, 0.005, -0.029), leaf, [x, y + r * 0.87, z], [0, k * TAU / 5, 0]);
        }
        break;
      case "corn":
        stem([0, 0.6, 0], 1.2, 0.048);
        for (let i = 0; i < 5; i++) add(foldedLeaf(0.48, 0.087, 0.23, 0.1), leaf, [0, 0.17 + i * 0.17, 0], [0, i * 2.4, 0]);
        if (ripe) {
          orb(body, [0.1, 0.6, 0], [0.115, 0.24, 0.115]);
          for (let row = 0; row < 6; row++) {
            const y = (row - 2.5) / 3.6;
            const radius = 0.108 * Math.sqrt(1 - y * y);
            for (let k = 0; k < 7; k++) {
              const a = k * TAU / 7 + row % 2 * 0.07;
              add(new THREE.IcosahedronGeometry(0.039), body, [0.1 + Math.sin(a) * radius, 0.6 + y * 0.23, Math.cos(a) * radius], [0, a, 0]);
            }
          }
          for (let i = -2; i <= 2; i++) stem([i * 0.036, 1.25, 0], 0.22, 0.009, -i * 0.22, 0xdfb868);
        }
        break;
      case "strawberry":
        leaves(7, 0.06, 0.34, 0.115, 0.15, 0.025, 0.6);
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + 0.2, x = Math.sin(a) * 0.26, z = Math.cos(a) * 0.26;
          if (ripe) {
            const points = [[0.005, 0], [0.08, 0.06], [0.14, 0.15], [0.12, 0.21], [0.045, 0.24]];
            add(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), 12), body, [x, 0.055, z]);
            for (let j = 0; j < 8; j++) {
              const b = j * TAU / 8;
              add(new THREE.OctahedronGeometry(1), 0xffdfa2, [x + Math.sin(b) * 0.128, 0.19 + j % 2 * 0.032, z + Math.cos(b) * 0.128], [0, b, 0], [0.011, 0.017, 0.011]);
            }
            for (let j = 0; j < 5; j++) add(foldedLeaf(0.09, 0.026, 0.015, -0.022), leaf, [x, 0.289, z], [0, j * TAU / 5, 0]);
          } else {
            for (let j = 0; j < 5; j++) add(new THREE.IcosahedronGeometry(1), 0xfffaea, [x + Math.sin(j * TAU / 5) * 0.05, 0.21, z + Math.cos(j * TAU / 5) * 0.05], [0, j, 0], [0.049, 0.027, 0.049]);
            add(new THREE.IcosahedronGeometry(1), 0xffce53, [x, 0.23, z], [0, 0, 0], [0.033, 0.025, 0.033]);
          }
        }
        break;
      case "pumpkin": {
        leaves(6, 0.08, 0.49, 0.16, 0.17, 0.08);
        const rind = new THREE.SphereGeometry(1, 40, 12);
        const pos = rind.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getZ(i);
          const rib = 0.92 + 0.085 * Math.cos(8 * Math.atan2(z, x));
          pos.setXYZ(i, x * rib, pos.getY(i), z * rib);
        }
        rind.computeVertexNormals();
        const r = ripe ? 0.39 : 0.21;
        add(rind, ripe ? body : 0xb3c875, [0, r * 0.72, 0], [0, 0, 0], [r, r * 0.78, r]);
        stem([0, r * 1.5 + 0.04, 0], 0.16, 0.043, -0.27, 0x85804e);
        break;
      }
    }
    if (mutation && ripe) {
      // 在果实旁留下三枚有棱角的结晶，让异色作物在远处也有独特轮廓。
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + 0.4;
        add(new THREE.OctahedronGeometry(0.064), variant!.fruit, [Math.cos(a) * 0.32, 0.26 + i % 2 * 0.1, Math.sin(a) * 0.32], [0.18, a, 0.2], [0.75, 1.85, 0.75]);
      }
    }
  }
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((part) => part.dispose());
  return merged;
}

export function createCropLibrary() {
  const geometry = new Map<string, THREE.BufferGeometry>();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const wind = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCropWind = wind;
    shader.vertexShader = "uniform float uCropWind;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       transformed.x += 0.026 * position.y * position.y * sin(uCropWind * 1.6 + instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.4);`
    );
  };
  return {
    material,
    wind,
    model(crop: CropId, stage: number, mutation: Mutation | null) {
      const key = stage < 2 ? `${crop}/${stage}` : `${crop}/${mutation}/${stage}`;
      let geo = geometry.get(key);
      if (!geo) {
        geo = growModel(crop, stage, stage < 2 ? null : mutation);
        geometry.set(key, geo);
      }
      return geo;
    },
    dispose() {
      geometry.forEach((geo) => geo.dispose());
      material.dispose();
    },
  };
}
