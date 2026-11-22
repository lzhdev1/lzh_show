import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CROPS, type CropId } from "../game/crops";
import { MUTATIONS, isSpirit, isWildMutation, type Mutation, type Spirit, wildMutationFamily } from "../game/weather";
import { createCropSpiritGeometry, createCropSpiritMaterial } from "./cropSpirits";

type Point = [number, number, number];
const TAU = Math.PI * 2;

/** 野菜按形态原型建模，20 个品种共享 11 种原型，靠配色区分 */
type WildArchetype = "rosette" | "puff" | "daisy" | "succulent" | "fern" | "sprig" | "coin" | "bell" | "herb" | "allium" | "celery" | "spike";
const WILD_ARCHETYPE: Partial<Record<CropId, WildArchetype>> = {
  jicai: "rosette", pugongying: "puff", machixian: "succulent", juecai: "fern",
  xiangchun: "sprig", yuqian: "coin", huaihua: "bell", huihuicai: "rosette",
  yexiancai: "rosette", cheqiancao: "spike", yuxingcao: "herb", yebohe: "herb",
  zisu: "herb", aicao: "herb", yecong: "allium", yesuan: "allium",
  shuiqin: "celery", louhao: "herb", malantou: "daisy", juhuanao: "daisy",
};

/** 按顶点位置重写颜色：阴阳双分、长生玉质都靠它（作用于合并后的整株） */
function recolorVertices(geometry: THREE.BufferGeometry, fn: (x: number, y: number, z: number, base: THREE.Color) => THREE.Color) {
  const position = geometry.getAttribute("position");
  const color = geometry.getAttribute("color") as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    c.fromBufferAttribute(color, i);
    const next = fn(position.getX(i), position.getY(i), position.getZ(i), c);
    color.setXYZ(i, next.r, next.g, next.b);
  }
  color.needsUpdate = true;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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
    const ruffled = !(mutation && isSpirit(mutation)) && (crop === "cabbage" || crop === "radish" || crop === "strawberry");
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
      case "eggplant": {
        stem([0, 0.42, 0], 0.84, 0.034);
        leaves(3, 0.3, 0.3, 0.11, 0.1, -0.02, 0.5);
        leaves(3, 0.56, 0.26, 0.1, 0.12, 0.02, 1.7);
        const count = ripe ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const a = i * TAU / count + 0.4, x = Math.sin(a) * 0.2, z = Math.cos(a) * 0.2, y = 0.3 + (i % 2) * 0.16;
          add(new THREE.SphereGeometry(1, 12, 9), ripe ? body : 0x9db86a, [x, y, z], [0.16, a, 0.1], [0.075, 0.155, 0.075]);
          for (let k = 0; k < 3; k++) add(foldedLeaf(0.085, 0.03, 0.008, -0.02), leaf, [x, y + 0.145, z], [0.2, k * TAU / 3 + a, 0]);
          stem([x, y + 0.18, z], 0.07, 0.012, 0.2);
        }
        break;
      }
      case "bean": {
        stem([0, 0.55, 0], 1.1, 0.028, 0.05, 0xb79863);
        stem([0.08, 0.52, -0.05], 1.05, 0.024, -0.06, 0xb79863);
        for (let j = 0; j < 3; j++) leaves(3, 0.3 + j * 0.26, 0.26, 0.09, 0.08, -0.03, j * 1.3);
        const pods = ripe ? 5 : 3;
        for (let i = 0; i < pods; i++) {
          const a = i * 2.4 + 0.7, x = Math.sin(a) * 0.16, z = Math.cos(a) * 0.16, y = 0.36 + (i % 3) * 0.2;
          add(new THREE.SphereGeometry(1, 8, 7), ripe ? body : 0x8fbf6a, [x, y, z], [0.3, a, 0.14], [0.028, ripe ? 0.14 : 0.09, 0.028]);
        }
        break;
      }
      case "chili": {
        stem([0, 0.36, 0], 0.72, 0.03);
        leaves(4, 0.26, 0.26, 0.09, 0.09, -0.02, 0.3);
        leaves(3, 0.5, 0.22, 0.08, 0.1, 0.02, 1.5);
        const pods = ripe ? 5 : 3;
        for (let i = 0; i < pods; i++) {
          const a = i * 2.4 + 1.1, x = Math.sin(a) * 0.18, z = Math.cos(a) * 0.18, y = 0.28 + (i % 2) * 0.18;
          add(new THREE.SphereGeometry(1, 9, 7), ripe ? body : 0x7fae5a, [x, y, z], [0.55, a, 0.2], [0.032, ripe ? 0.115 : 0.07, 0.032]);
          stem([x * 0.8, y + 0.1, z * 0.8], 0.05, 0.01, 0.3);
        }
        break;
      }
      case "watermelon": {
        leaves(5, 0.05, 0.4, 0.13, 0.1, 0.05, 0.2);
        const r = ripe ? 0.33 : 0.16;
        const melon = new THREE.SphereGeometry(1, 26, 15);
        const mp = melon.getAttribute("position");
        const mc = new Float32Array(mp.count * 3);
        const light = new THREE.Color(ripe ? body : 0x7fae5a), dark = new THREE.Color(ripe ? 0x1e4d26 : 0x4c7a3a);
        for (let i = 0; i < mp.count; i++) {
          const band = Math.floor((Math.atan2(mp.getZ(i), mp.getX(i)) / Math.PI + 1) * 5) % 2 === 0;
          const c = band ? dark : light;
          mc[i * 3] = c.r; mc[i * 3 + 1] = c.g; mc[i * 3 + 2] = c.b;
        }
        melon.setAttribute("color", new THREE.BufferAttribute(mc, 3));
        add(melon, 0xffffff, [0.05, r * 0.82, 0], [0, 0.3, 0], [r, r * 0.85, r]);
        stem([0.05, r * 1.68, 0], 0.09, 0.024, 0.35, 0x6a8a4a);
        break;
      }
      case "peach":
      case "apricot":
      case "jujube":
      case "pear":
      case "durian": {
        // 矮果树：树干 + 两团树冠 + 挂在冠下的果实
        stem([0, 0.38, 0], 0.76, 0.05, 0, 0x8a6a4a);
        orb(leaf, [0, 0.92, 0], [0.4, 0.32, 0.4]);
        orb(tint.setHex(leaf).offsetHSL(0.01, 0, 0.05).getHex(), [0.17, 1.04, 0.09], [0.23, 0.19, 0.23]);
        const count = crop === "jujube" ? 5 : crop === "durian" ? 2 : 3;
        const r = ripe ? (crop === "jujube" ? 0.055 : crop === "durian" ? 0.14 : 0.095) : 0.05;
        for (let i = 0; i < count; i++) {
          const a = i * TAU / count + 0.5, x = Math.sin(a) * 0.28, z = Math.cos(a) * 0.28, y = 0.76 + (i % 2) * 0.1;
          const color = ripe ? body : 0x9db86a;
          if (crop === "pear") {
            orb(color, [x, y, z], [r, r * 1.05, r]);
            orb(color, [x, y + r * 1.35, z], [r * 0.6, r * 0.7, r * 0.6]);
          } else if (crop === "jujube") {
            add(new THREE.SphereGeometry(1, 9, 7), color, [x, y, z], [0.2, a, 0.1], [r * 0.8, r * 1.2, r * 0.8]);
          } else if (crop === "durian") {
            orb(color, [x, y, z], [r, r * 1.1, r]);
            if (ripe) for (let k = 0; k < 10; k++) {
              const phi = Math.acos(1 - 2 * (k + 0.5) / 10), theta = Math.PI * (1 + Math.sqrt(5)) * k;
              const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
              const spike = new THREE.ConeGeometry(0.02, 0.055, 5);
              spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
              add(spike, body, [x + dir.x * r, y + dir.y * r * 1.1, z + dir.z * r]);
            }
          } else {
            orb(color, [x, y, z], [r, r * 0.95, r]);
          }
          stem([x, y + r + 0.03, z], 0.06, 0.01, 0.15);
        }
        break;
      }
      case "tulip": {
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 + 0.3, x = Math.sin(a) * 0.2, z = Math.cos(a) * 0.2;
          stem([x, 0.34, z], 0.72, 0.022);
          add(foldedLeaf(0.48, 0.062, 0.22, 0.1), leaf, [x, 0.02, z], [0, a + 1.2, 0]);
          add(foldedLeaf(0.34, 0.052, 0.16, 0.13), leaf, [x, 0.02, z], [0, a + 2.7, 0]);
          if (ripe) {
            const out = tint.setHex(body).offsetHSL(0, -0.01, 0.08).getHex();
            const inside = tint.setHex(body).offsetHSL(0, 0.06, -0.09).getHex();
            // 郁金香的杯形花冠：外三片先立起来微微外翻，内三片错开夹角再收紧
            for (let k = 0; k < 3; k++) {
              add(foldedLeaf(0.25, 0.11, 0.055, 0.014, true), out, [x, 0.66, z], [-1.1, a + k * TAU / 3, 0]);
            }
            for (let k = 0; k < 3; k++) {
              add(foldedLeaf(0.31, 0.09, 0.04, 0.006, true), inside, [x, 0.68, z], [-1.32, a + k * TAU / 3 + TAU / 6, 0]);
            }
            orb(0xf3d272, [x, 0.68, z], [0.026, 0.055, 0.026]);
          } else {
            orb(0x8fbf6a, [x, 0.66, z], [0.055, 0.09, 0.055]);
            for (let k = 0; k < 3; k++) add(foldedLeaf(0.11, 0.045, 0.025, 0.03), leaf, [x, 0.67, z], [-1.25, a + k * TAU / 3, 0]);
          }
        }
        break;
      }
      case "lily": {
        stem([0, 0.44, 0], 0.9, 0.028);
        for (let j = 0; j < 4; j++) add(foldedLeaf(0.36, 0.056, 0.12, 0.07), leaf, [0, 0.12 + j * 0.2, 0], [0, j * 1.7, 0]);
        if (ripe) {
          const pale = tint.setHex(body).lerp(new THREE.Color(0xffffff), 0.42).getHex();
          const deep = tint.setHex(body).offsetHSL(0, 0.06, -0.02).getHex();
          // 六瓣百合：外三瓣先开，内三瓣错开收拢，瓣缘带褶
          for (let k = 0; k < 3; k++) {
            add(foldedLeaf(0.36, 0.13, 0.1, 0.15, true), pale, [0, 0.86, 0], [-0.6, k * TAU / 3 + 0.12, 0]);
          }
          for (let k = 0; k < 3; k++) {
            add(foldedLeaf(0.32, 0.11, 0.085, 0.13, true), deep, [0, 0.88, 0], [-0.34, k * TAU / 3 + TAU / 6 + 0.12, 0]);
          }
          // 花蕊：六根雄蕊带紫黄花药，中间一根雌蕊更长
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6 + 0.3;
            add(new THREE.CylinderGeometry(0.0028, 0.004, 0.2, 4), 0xe8dfc6,
              [Math.sin(a) * 0.05, 0.97, Math.cos(a) * 0.05], [0.15 * Math.cos(a), 0, -0.15 * Math.sin(a)]);
            orb(0xc99a2c, [Math.sin(a) * 0.074, 1.06, Math.cos(a) * 0.074], [0.013, 0.009, 0.013]);
          }
          add(new THREE.CylinderGeometry(0.0042, 0.0055, 0.24, 4), 0xcfc2a0, [0, 0.99, 0], [0, 0, 0]);
          orb(0xa99668, [0, 1.1, 0], [0.012, 0.016, 0.012]);
        } else {
          orb(0xcfe0b8, [0, 0.9, 0], [0.05, 0.11, 0.05]);
          for (let k = 0; k < 3; k++) add(foldedLeaf(0.13, 0.052, 0.035, 0.05), leaf, [0, 0.9, 0], [-0.75, k * TAU / 3, 0]);
        }
        break;
      }
      case "roseRed":
      case "rosePink":
      case "roseWhite":
      case "roseYellow":
      case "roseBlue":
      case "rosePurple": {
        stem([0, 0.44, 0], 0.92, 0.032);
        add(foldedLeaf(0.3, 0.08, 0.1, 0.035), leaf, [0, 0.24, 0], [0, 0.7, 0]);
        add(foldedLeaf(0.28, 0.074, 0.085, 0.035), leaf, [0, 0.5, 0], [0, 3.5, 0]);
        if (ripe) {
          const inner = tint.setHex(body).offsetHSL(0, 0.03, -0.08).getHex();
          const mid = tint.setHex(body).offsetHSL(0, 0.01, 0.02).getHex();
          const outer = tint.setHex(body).offsetHSL(0, -0.02, 0.14).getHex();
          // 花萼五片，压在花底下
          for (let k = 0; k < 5; k++) add(foldedLeaf(0.13, 0.036, 0.03, -0.02), leaf, [0, 0.94, 0], [-0.95, k * TAU / 5 + 0.2, 0]);
          // 三层花瓣由外向内一层层收，外圈最开、内圈几乎包成花心
          for (let k = 0; k < 8; k++) add(foldedLeaf(0.23, 0.115, 0.09, 0.05, true), outer, [0, 0.95, 0], [-0.95, k * TAU / 8, 0]);
          for (let k = 0; k < 6; k++) add(foldedLeaf(0.19, 0.098, 0.08, 0.04, true), mid, [0, 0.975, 0], [-0.6, k * TAU / 6 + 0.28, 0]);
          for (let k = 0; k < 4; k++) add(foldedLeaf(0.15, 0.082, 0.07, 0.03, true), inner, [0, 0.995, 0], [-0.4, k * TAU / 4 + 0.6, 0]);
          orb(inner, [0, 1.0, 0], [0.03, 0.038, 0.03]);
          orb(outer, [0, 1.028, 0], [0.017, 0.022, 0.017]);
        } else {
          orb(0x8fbf6a, [0, 0.9, 0], [0.05, 0.07, 0.05]);
          for (let k = 0; k < 3; k++) add(foldedLeaf(0.09, 0.03, 0.012, -0.015), leaf, [0, 0.88, 0], [-0.7, k * TAU / 3, 0]);
        }
        break;
      }
      case "pineapple": {
        leaves(8, 0.04, 0.42, 0.07, 0.2, 0.16, 0.2);
        const r = ripe ? 1 : 0.55;
        const fruit = new THREE.SphereGeometry(1, 18, 12);
        const fp = fruit.getAttribute("position");
        const fc = new Float32Array(fp.count * 3);
        const gold = new THREE.Color(ripe ? body : 0x9db86a), seam = new THREE.Color(ripe ? 0xb8842c : 0x6a8a4a);
        for (let i = 0; i < fp.count; i++) {
          const s = Math.sin(Math.atan2(fp.getZ(i), fp.getX(i)) * 6) + Math.sin(fp.getY(i) * 12);
          const c = s > 0.7 ? seam : gold;
          fc[i * 3] = c.r; fc[i * 3 + 1] = c.g; fc[i * 3 + 2] = c.b;
        }
        fruit.setAttribute("color", new THREE.BufferAttribute(fc, 3));
        add(fruit, 0xffffff, [0, 0.3 * r + 0.06, 0], [0, 0, 0], [0.14 * r, 0.19 * r, 0.14 * r]);
        leaves(5, 0.5 * r + 0.08, 0.16 * r, 0.035, 0.1, 0.1, 0.6);
        break;
      }
      default: {
        // —— 野菜：按原型建模 ——
        const archetype = WILD_ARCHETYPE[crop] ?? "rosette";
        const size = ripe ? 1 : 0.7;
        if (archetype === "rosette" || archetype === "daisy" || archetype === "spike" || archetype === "puff") {
          leaves(6, 0.03, 0.26 * size, 0.09, 0.08, 0.03, 0.4);
          leaves(4, 0.05, 0.16 * size, 0.07, 0.1, 0.08, 1.2);
        }
        if (archetype === "rosette") {
          orb(body, [0, 0.08 * size, 0], [0.05, 0.06, 0.05]);
        } else if (archetype === "puff") {
          stem([0, 0.17 * size, 0], 0.34 * size, 0.012);
          orb(body, [0, 0.36 * size, 0], [0.075, 0.075, 0.075]);
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6;
            orb(tint.setHex(body).offsetHSL(0, 0, 0.08).getHex(), [Math.sin(a) * 0.06, 0.36 * size + Math.cos(a) * 0.05, Math.sin(a * 2) * 0.04], [0.03, 0.03, 0.03]);
          }
        } else if (archetype === "daisy") {
          stem([0, 0.15 * size, 0], 0.3 * size, 0.012);
          orb(0xf2c94c, [0, 0.32 * size, 0], [0.035, 0.03, 0.035]);
          for (let k = 0; k < 6; k++) add(foldedLeaf(0.07, 0.025, 0.015, 0.01), body, [0, 0.32 * size, 0], [-0.25, k * TAU / 6, 0]);
        } else if (archetype === "spike") {
          for (let k = 0; k < 2; k++) {
            const x = (k - 0.5) * 0.1;
            stem([x, 0.18 * size, 0], 0.36 * size, 0.009, (k - 0.5) * 0.2);
            add(new THREE.SphereGeometry(1, 7, 6), body, [x + (k - 0.5) * 0.07, 0.38 * size, 0], [0, 0, (k - 0.5) * 0.2], [0.018, 0.055, 0.018]);
          }
        } else if (archetype === "succulent") {
          for (let i = 0; i < 4; i++) {
            const a = i * TAU / 4 + 0.3;
            add(new THREE.CylinderGeometry(0.012, 0.016, 0.22 * size, 5), leaf, [Math.sin(a) * 0.09, 0.05, Math.cos(a) * 0.09], [1.25, a, 0]);
            for (let j = 0; j < 3; j++) orb(body, [Math.sin(a) * (0.08 + j * 0.06), 0.06 + j * 0.015, Math.cos(a) * (0.08 + j * 0.06)], [0.035, 0.02, 0.045]);
          }
        } else if (archetype === "fern") {
          for (let i = 0; i < 3; i++) {
            const a = i * TAU / 3 + 0.2, x = Math.sin(a) * 0.08, z = Math.cos(a) * 0.08;
            stem([x, 0.16 * size, z], 0.32 * size, 0.014, 0.18);
            add(new THREE.TorusGeometry(0.045, 0.013, 5, 10, Math.PI * 1.4), body, [x + 0.05, 0.34 * size, z], [0.3, a, 0.4]);
            for (let j = 0; j < 3; j++) add(foldedLeaf(0.08, 0.025, 0.02, 0.01), leaf, [x, 0.1 + j * 0.07, z], [0, a + j, 0]);
          }
        } else if (archetype === "sprig") {
          stem([0, 0.2 * size, 0], 0.4 * size, 0.016, 0, 0x8a6a4a);
          for (let j = 0; j < 4; j++) {
            const y = (0.14 + j * 0.08) * size;
            add(foldedLeaf(0.12, 0.04, 0.03, 0.02), j % 2 ? body : leaf, [0, y, 0], [0, j * 1.9, 0]);
            add(foldedLeaf(0.12, 0.04, 0.03, 0.02), j % 2 ? leaf : body, [0, y, 0], [0, j * 1.9 + Math.PI, 0]);
          }
        } else if (archetype === "coin") {
          stem([0, 0.18 * size, 0], 0.36 * size, 0.014, 0, 0x8a6a4a);
          for (let k = 0; k < 7; k++) {
            const a = k * 2.4, r = 0.05 + (k % 3) * 0.03;
            add(new THREE.CylinderGeometry(0.042, 0.042, 0.01, 9), body, [Math.sin(a) * r, (0.26 + (k % 4) * 0.045) * size, Math.cos(a) * r], [0.4 + k * 0.2, a, 0.2]);
          }
        } else if (archetype === "bell") {
          stem([0, 0.2 * size, 0], 0.4 * size, 0.014, 0.1);
          for (let k = 0; k < 5; k++) {
            const t = k / 4;
            orb(body, [0.06 + t * 0.05, (0.36 - t * 0.14) * size, (k % 2 - 0.5) * 0.05], [0.032, 0.045, 0.032]);
          }
          add(foldedLeaf(0.12, 0.04, 0.03, 0.02), leaf, [0, 0.3 * size, 0], [0, 2.2, 0]);
        } else if (archetype === "herb") {
          stem([0, 0.19 * size, 0], 0.38 * size, 0.014);
          for (let j = 0; j < 3; j++) {
            const y = (0.12 + j * 0.09) * size;
            add(foldedLeaf(0.14, 0.055, 0.04, 0.02), leaf, [0, y, 0], [0, j * 1.6 + 0.5, 0]);
            add(foldedLeaf(0.14, 0.055, 0.04, 0.02), leaf, [0, y, 0], [0, j * 1.6 + 0.5 + Math.PI, 0]);
          }
          orb(body, [0, 0.4 * size, 0], [0.03, 0.05, 0.03]);
        } else if (archetype === "allium") {
          for (let k = 0; k < 4; k++) {
            const a = k * TAU / 4 + 0.4;
            stem([Math.sin(a) * 0.04, 0.16 * size, Math.cos(a) * 0.04], 0.32 * size, 0.011, 0.16 * Math.sin(a));
          }
          orb(0xe8e8d8, [0, 0.04, 0], [0.04, 0.05, 0.04]);
          orb(body, [0.05, 0.34 * size, 0], [0.035, 0.035, 0.035]);
        } else if (archetype === "celery") {
          for (let k = 0; k < 3; k++) {
            const a = k * TAU / 3, x = Math.sin(a) * 0.06, z = Math.cos(a) * 0.06;
            stem([x, 0.16 * size, z], 0.32 * size, 0.016, 0.1 * Math.sin(a));
            leaves(3, 0.32 * size, 0.1, 0.04, 0.04, 0.02, a, 0.05);
          }
        }
        break;
      }
    }
    if (mutation && ripe && !isWildMutation(mutation)) {
      // 形状和发光纹样分别构建，日光下也能读出剪影。
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + 0.4;
        const x = Math.cos(a)*.30, z = Math.sin(a)*.30, y = .26 + i%2*.10;
        if (mutation === "thunder") {
          add(new THREE.TetrahedronGeometry(.10), 0xe7cbff, [x,y+.085,z],[.1,a,-.5],[.59,1.45,.6]);
          add(new THREE.TetrahedronGeometry(.092), body,[x+.025,y-.025,z],[.2,a,2.6],[.61,1.45,.6]);
        } else if (mutation === "flame") {
          add(new THREE.ConeGeometry(.056,.24,7),0xffbd56,[x,y,z],[.22,a,-.28]);
          add(new THREE.ConeGeometry(.036,.16,6),0xff6041,[x-.035,y-.042,z],[.14,a,.32]);
        } else if (mutation === "wind") {
          add(foldedLeaf(.32,.056,.18,.14),0xaeffdd,[x,y-.14,z],[.04,a,-.18]);
        } else if (mutation === "gold") {
          add(new THREE.TorusGeometry(.067,.014,5,12),0xffdb73,[x,y,z],[0,a,.19]);
        } else if (mutation === "earth") {
          add(new THREE.DodecahedronGeometry(.095),0xba8b57,[x,y-.16,z],[.3,a,.12]);
          add(foldedLeaf(.15,.05,.04,.09),0xadce77,[x,y-.09,z],[.1,a,0]);
        } else {
          add(new THREE.OctahedronGeometry(.077), variant!.fruit,[x,y,z],[.18,a,.2],[.75,2,.75]);
        }
      }
    }
  }
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((part) => part.dispose());
  // 野菜变异是整株材质变化：阴阳按左右双分，长生做玉质渐变，生长期也可见
  if (mutation && isWildMutation(mutation)) {
    const out = new THREE.Color();
    if (wildMutationFamily(mutation) === "yinyang") {
      const black = new THREE.Color(0x26262e), white = new THREE.Color(0xf4f1e8);
      recolorVertices(merged, (x, _y, _z, base) =>
        out.copy(black).lerp(white, smoothstep(-0.05, 0.05, x)).multiplyScalar(0.88 + 0.24 * base.g));
    } else {
      const deep = new THREE.Color(0x5fae8a), pale = new THREE.Color(0xd6f5e2);
      recolorVertices(merged, (x, y, z, base) => {
        const vein = 0.5 + 0.5 * Math.sin(x * 14 + z * 11 + y * 6);
        return out.copy(deep).lerp(pale, smoothstep(0, 0.9, y) * 0.7 + vein * 0.3).multiplyScalar(0.9 + 0.18 * base.g);
      });
    }
  }
  return merged;
}

export function createCropLibrary() {
  const geometry = new Map<string, THREE.BufferGeometry>();
  const dolls = new Map<Spirit, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }>();
  const warming = new Map<Spirit, number>();
  function dollFor(id: Spirit) {
    let doll = dolls.get(id);
    if (!doll) {
      doll = { geometry: createCropSpiritGeometry(id), material: createCropSpiritMaterial(id) };
      dolls.set(id, doll);
    }
    return doll;
  }
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
    wind,
    model(crop: CropId, stage: number, mutation: Mutation | null) {
      if (mutation && isSpirit(mutation)) {
        if (stage === 3) return dollFor(mutation);
        // Mutation is known at planting time. Prepare only the figurines the
        // farm will actually need, while the crop still has time to grow.
        if (!dolls.has(mutation) && !warming.has(mutation) && typeof requestIdleCallback === "function") {
          warming.set(mutation, requestIdleCallback(() => {
            warming.delete(mutation);
            dollFor(mutation);
          }));
        }
      }
      const key = stage < 2 ? `${crop}/${stage}` : `${crop}/${mutation}/${stage}`;
      let geo = geometry.get(key);
      if (!geo) {
        geo = growModel(crop, stage, stage < 2 ? null : mutation);
        geometry.set(key, geo);
      }
      return { geometry: geo, material };
    },
    dispose() {
      warming.forEach(handle => cancelIdleCallback(handle));
      warming.clear();
      geometry.forEach((geo) => geo.dispose());
      dolls.forEach(doll => {
        doll.geometry.dispose();
        doll.material.map?.dispose();
        doll.material.dispose();
      });
      material.dispose();
    },
  };
}
