import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CROPS, type CropId, type HerbId } from "../game/crops";
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

/** 草药按 11 类药圃形态建模，50 种靠 scale / 花量 / 配色区分 */
type HerbArchetype = "root" | "cap" | "berry" | "umbel" | "spike" | "head"
  | "vine" | "bulb" | "tree" | "aroid" | "herb";
export const HERB_FORM: Record<HerbId, { arch: HerbArchetype; scale: number; bloom: number }> = {
  // 根茎类：主根 + 复叶 + 红果
  renshen:     { arch: "root",  scale: 1.05, bloom: 1.15 },
  sanqi:       { arch: "root",  scale: 0.86, bloom: 1.0 },
  baishao:     { arch: "root",  scale: 0.9,  bloom: 1.1 },
  // 菌类：菌盖 + 环纹
  lingzhi:     { arch: "cap",   scale: 0.92, bloom: 1.1 },
  fuling:      { arch: "cap",   scale: 0.78, bloom: 0.95 },
  // 浆果灌木
  gouqi:       { arch: "berry", scale: 1.0,  bloom: 1.2 },
  nvzhenzi:    { arch: "berry", scale: 1.05, bloom: 1.0 },
  shanzhuyu:   { arch: "berry", scale: 0.98, bloom: 1.15 },
  wuweizi:     { arch: "berry", scale: 1.0,  bloom: 1.1 },
  // 伞形花序
  danggui:     { arch: "umbel", scale: 0.95, bloom: 1.15 },
  chuanxiong:  { arch: "umbel", scale: 0.88, bloom: 1.0 },
  chaihu:      { arch: "umbel", scale: 0.82, bloom: 0.95 },
  fangfeng:    { arch: "umbel", scale: 0.95, bloom: 1.05 },
  duhuo:       { arch: "umbel", scale: 0.92, bloom: 1.0 },
  qianghuo:    { arch: "umbel", scale: 0.86, bloom: 0.95 },
  baizhi:      { arch: "umbel", scale: 0.98, bloom: 1.1 },
  // 穗状花序
  huangqi:     { arch: "spike", scale: 0.95, bloom: 1.05 },
  gancao:      { arch: "spike", scale: 0.8,  bloom: 1.0 },
  danshen:     { arch: "spike", scale: 0.9,  bloom: 1.1 },
  huangqin:    { arch: "spike", scale: 0.86, bloom: 1.0 },
  huanglian:   { arch: "spike", scale: 0.75, bloom: 0.9 },
  banlangen:   { arch: "spike", scale: 0.82, bloom: 0.95 },
  daqingye:    { arch: "spike", scale: 0.9,  bloom: 0.85 },
  xiakucao:    { arch: "spike", scale: 0.88, bloom: 1.2 },
  yimucao:     { arch: "spike", scale: 1.0,  bloom: 1.2 },
  tianma:      { arch: "spike", scale: 0.7,  bloom: 1.0 },
  // 头状花序（花朵大）
  juhua:       { arch: "head",  scale: 0.95, bloom: 1.2 },
  honghua:     { arch: "head",  scale: 0.9,  bloom: 1.1 },
  jiegeng:     { arch: "head",  scale: 0.88, bloom: 1.0 },
  xuelian:     { arch: "head",  scale: 1.0,  bloom: 1.25 },
  // 藤本
  jinyinhua:   { arch: "vine",  scale: 1.0,  bloom: 1.1 },
  heshouwu:    { arch: "vine",  scale: 1.05, bloom: 1.0 },
  // 鳞茎 / 兰科
  shihu:       { arch: "bulb",  scale: 0.9,  bloom: 1.05 },
  // 矮乔木（树皮 / 果皮入药）
  duzhong:     { arch: "tree",  scale: 1.0,  bloom: 0.9 },
  rougui:      { arch: "tree",  scale: 1.05, bloom: 0.85 },
  houpo:       { arch: "tree",  scale: 1.1,  bloom: 0.95 },
  chenpi:      { arch: "tree",  scale: 0.85, bloom: 1.2 },
  lianqiao:    { arch: "tree",  scale: 0.95, bloom: 1.15 },
  juemingzi:   { arch: "tree",  scale: 0.8,  bloom: 1.0 },
  // 宽叶块根 / 姜科
  baizhu:      { arch: "aroid", scale: 0.92, bloom: 1.0 },
  cangzhu:     { arch: "aroid", scale: 0.9,  bloom: 0.95 },
  banxia:      { arch: "aroid", scale: 0.78, bloom: 0.9 },
  sharen:      { arch: "aroid", scale: 0.85, bloom: 1.15 },
  // 方茎香草
  longnaobohe: { arch: "herb",  scale: 0.85, bloom: 1.0 },
  suye:        { arch: "herb",  scale: 0.92, bloom: 1.05 },
  qiai:        { arch: "herb",  scale: 1.0,  bloom: 0.85 },
  huoxiang:    { arch: "herb",  scale: 0.95, bloom: 1.1 },
  peilan:      { arch: "herb",  scale: 0.9,  bloom: 1.05 },
  xiangru:     { arch: "herb",  scale: 0.82, bloom: 1.0 },
  jingjie:     { arch: "herb",  scale: 0.86, bloom: 1.0 },
};

/** 鲜花作物：玫瑰六色 / 百合 / 郁金香。观赏为主，一块地只种两棵大株 */
export function isFlowerCrop(crop: CropId): boolean {
  return crop === "lily" || crop === "tulip" || crop.startsWith("rose");
}

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
// petal=true 时改用花瓣剖面：基部窄、中段展宽、端部圆收，而不是叶子的两端尖。
function foldedLeaf(length: number, width: number, height: number, tip: number, ruffled = false, petal = false): THREE.BufferGeometry {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = length < 0.13 ? 3 : (ruffled || petal ? 14 : 8);
  const lanes = length < 0.13 ? [-1, 0, 1] : (petal ? [-1, -0.6, -0.2, 0, 0.2, 0.6, 1] : [-1, -0.12, 0, 0.12, 1]);
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const arc = Math.sin(t * Math.PI);
    const swell = petal
      ? (t < 0.7 ? 0.25 + 0.75 * (t / 0.7) : Math.sqrt(Math.max(0.02, 1 - ((t - 0.7) / 0.3) ** 2)))
      : arc ** (ruffled ? 0.57 : 0.85);
    const scallop = ruffled ? 1 + 0.09 * Math.cos(t * Math.PI * 7) : 1;
    const edge = Math.max(0.004, swell) * width * scallop;
    const curl = petal ? height * Math.sin(t * Math.PI * 0.9) + tip * t : height * arc + tip * t;
    for (let j = 0; j < lanes.length; j++) {
      const u = lanes[j], rim = Math.abs(u);
      const lateral = width * 0.16 * Math.sin(t * Math.PI * 1.6);
      const fold = (1 - rim) * swell * width * (petal ? -0.34 : 0.42);
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
  // 鲜花变异只加强光效，不改花色：始终用品种本色
  const flower = isFlowerCrop(crop);
  const leaf = flower ? CROPS[crop].leaf : (variant?.leaf ?? CROPS[crop].leaf);
  const body = flower ? CROPS[crop].body : (variant?.fruit ?? CROPS[crop].body);

  function add(geo: THREE.BufferGeometry, color: number, pos: Point, rot: Point = [0, 0, 0], scale: Point = [1, 1, 1], yxz = false) {
    transform.position.set(...pos);
    transform.rotation.order = yxz ? "YXZ" : "XYZ";
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
  /** 两点之间长一根锥形枝干：四元数定向，用来接出花序分叉与弯曲主茎 */
  function limb(from: Point, to: Point, w0: number, w1: number, color = leaf) {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz) || 0.01;
    const geo = new THREE.CylinderGeometry(w1, w0, len, 6);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()));
    geo.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    add(geo, color, [0, 0, 0], [0, 0, 0]);
  }
  /** 茎上一个叶节点：绕茎散开若干片小叶，模拟羽状/轮生叶序 */
  function leafNode(at: Point, count: number, len: number, wid: number, yaw = 0, lift = 0.16) {
    for (let k = 0; k < count; k++) {
      const a = yaw + k * TAU / count + 0.07 * Math.sin(k * 2.1);
      const tone = tint.setHex(leaf).offsetHSL(0, 0, 0.03 * Math.cos(k * 1.7)).getHex();
      add(foldedLeaf(len * (0.9 + (k % 3) * 0.08), wid, lift, wid * 0.4), tone, at, [0.1 * Math.sin(k), a, 0]);
    }
  }

  /* —— 草药：11 类药圃形态，靠药性部位（根 / 菌盖 / 浆果 / 花序 / 树皮）区分 —— */
  function herbModel(herb: HerbId, ripe: boolean) {
    const form = HERB_FORM[herb];
    const s = form.scale * (ripe ? 1 : 0.72) * 1.68;
    const q = form.bloom * (ripe ? 1 : 0.8);
    const arch = form.arch;
    const bark = tint.setHex(leaf).offsetHSL(0, -0.16, -0.2).getHex();
    const pale = tint.setHex(body).lerp(new THREE.Color(0xf6f3e2), 0.55).getHex();
    const deep = tint.setHex(body).offsetHSL(0, 0.06, -0.12).getHex();
    const petal = (color: number, len: number, wid: number, y: number, a: number, tilt: number, rad = 0) =>
      add(foldedLeaf(len, wid, len * 0.22, wid * 0.5), color,
        [Math.sin(a) * rad, y, Math.cos(a) * rad], [tilt, a, 0]);
    const leafAt = (color: number, len: number, wid: number, x: number, y: number, z: number, tilt: number, yaw: number) =>
      add(foldedLeaf(len, wid, len * 0.22, wid * 0.5), color, [x, y, z], [tilt, yaw, 0]);
    /** 两点之间长一根锥形枝干：用四元数定向，避免欧拉角把枝条放倒 */
    const branch = (from: Point, to: Point, w0: number, w1: number, color: number) => {
      const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
      const len = Math.hypot(dx, dy, dz) || 0.01;
      const geo = new THREE.CylinderGeometry(w1, w0, len, 6);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()));
      geo.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
      add(geo, color, [0, 0, 0], [0, 0, 0]);
    };

    if (arch === "root") {
      // 主根：车削出圆肩收尖，侧根两条，地面只露根肩
      const profile = [[0.006, 0], [0.062, 0.04], [0.105, 0.13], [0.09, 0.25], [0.045, 0.34], [0.016, 0.4]];
      add(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 16),
        tint.setHex(body).offsetHSL(0, 0.04, -0.14).getHex(), [0, -0.06, 0], [0, 0, 0], [s, s * 1.08, s]);
      add(new THREE.CylinderGeometry(0.014, 0.026, 0.3, 6), bark, [0.1 * s, 0.1 * s, 0.02], [0.2, 0.4, -0.5]);
      add(new THREE.CylinderGeometry(0.011, 0.022, 0.26, 6), bark, [-0.09 * s, 0.09 * s, -0.04], [-0.3, 1.1, 0.6]);
      // 三枝复叶，每枝三小叶
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3 + 0.4;
        const bx = Math.sin(a) * 0.05 * s, bz = Math.cos(a) * 0.05 * s;
        add(new THREE.CylinderGeometry(0.0055, 0.008, 0.3 * s, 5), leaf, [bx, 0.19 * s, bz], [0.16, a, 0.12]);
        for (let j = 0; j < 3; j++) {
          petal(leaf, 0.15 * s, 0.055 * s, 0.28 * s + j * 0.005, a + (j - 1) * 0.36, 0.42 + j * 0.08, 0.04);
        }
      }
      // 人参红果伞
      for (let k = 0; k < Math.round(6 * q); k++) {
        const a = k * 2.4, y = 0.34 * s + (k % 3) * 0.028;
        orb(deep, [Math.sin(a) * 0.07, y, Math.cos(a) * 0.06], [0.021 * s, 0.019 * s, 0.021 * s]);
      }
      if (herb === "baishao") {
        for (let k = 0; k < 5; k++) petal(pale, 0.15 * s, 0.08 * s, 0.33 * s, k * TAU / 5, -0.5, 0.09);
        orb(0xf3d36a, [0, 0.31 * s, 0], [0.035, 0.02, 0.035]);
      }
    } else if (arch === "cap") {
      // 菌盖：半球 + 三道环纹 + 褶边，柄在下方
      const cap = new THREE.SphereGeometry(0.19, 22, 12, 0, TAU, 0, Math.PI / 2);
      add(cap, herb === "fuling" ? 0xf1e9d6 : deep, [0, 0.19 * s, 0], [0, 0, 0], [s, 0.62 * s, s]);
      for (let r = 1; r <= 3; r++) {
        add(new THREE.TorusGeometry((0.175 - r * 0.038) * s, 0.0045, 4, 26),
          herb === "fuling" ? 0xe0d5bb : 0xc98a52, [0, (0.255 - r * 0.018) * s, 0], [Math.PI / 2, 0, 0]);
      }
      for (let k = 0; k < 16; k++) {
        petal(herb === "fuling" ? 0xf6efdd : 0xb56a37, 0.07 * s, 0.02, 0.155 * s, k * TAU / 16, 1.6, 0.175 * s);
      }
      add(new THREE.CylinderGeometry(0.035, 0.05, 0.24 * s, 8), 0xe7d9b8, [0, 0.06 * s, 0]);
      // 灵芝孢子粉
      if (herb === "lingzhi") {
        for (let k = 0; k < 7; k++) {
          const a = k * 1.7;
          orb(0xd9a86a, [Math.sin(a) * 0.09, 0.27 * s + (k % 2) * 0.01, Math.cos(a) * 0.07], [0.012, 0.008, 0.012]);
        }
      }
    } else if (arch === "berry") {
      // 小灌木：三枝分叉上举，对生叶，浆果成串垂在枝侧
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3 + 0.2;
        const base: Point = [Math.sin(a) * 0.035, 0.02, Math.cos(a) * 0.035];
        const mid: Point = [Math.sin(a) * 0.12, 0.26 * s, Math.cos(a) * 0.12];
        const tip: Point = [Math.sin(a) * 0.205, 0.52 * s, Math.cos(a) * 0.205];
        branch(base, mid, 0.013, 0.009, bark);
        branch(mid, tip, 0.009, 0.005, bark);
        for (let j = 0; j < 5; j++) {
          const y = (0.13 + j * 0.085) * s;
          const a2 = a + (j % 2 ? 1.15 : -1.15) + 0.35;
          const rad = 0.055 + j * 0.022;
          leafAt(leaf, 0.17 * s, 0.065 * s, Math.sin(a) * rad, y, Math.cos(a) * rad, 0.4, a2);
        }
        for (let j = 0; j < Math.round(5 * q); j++) {
          const a2 = a + 0.45 + j * 0.5;
          const rad = 0.11 + j * 0.02;
          orb(j % 3 === 1 ? deep : body,
            [Math.sin(a) * rad + Math.sin(a2) * 0.05, (0.33 + j * 0.032) * s, Math.cos(a) * rad + Math.cos(a2) * 0.05],
            [0.029 * s, 0.035 * s, 0.029 * s]);
        }
      }
    } else if (arch === "umbel") {
      // 伞形科：粗茎、羽状叶、复伞花序
      add(new THREE.CylinderGeometry(0.012, 0.022, 0.5 * s, 7), tint.setHex(leaf).offsetHSL(0, 0.02, 0.04).getHex(), [0, 0.25 * s, 0]);
      for (let k = 0; k < 3; k++) {
        const y = (0.14 + k * 0.1) * s, a = k * 1.9;
        for (let j = -1; j <= 1; j++) {
          petal(leaf, (0.2 - k * 0.03) * s, 0.05 * s, y, a + j * 0.55, 0.22 + Math.abs(j) * 0.16, 0.03);
        }
      }
      // 伞辐：十根细梗托起小球簇
      for (let k = 0; k < Math.round(12 * q); k++) {
        const a = k * TAU / 12 + 0.3, rad = (0.055 + (k % 3) * 0.018) * s, y = 0.52 * s + (k % 2) * 0.02;
        add(new THREE.CylinderGeometry(0.0032, 0.0045, 0.1 * s, 4), leaf,
          [Math.sin(a) * rad * 0.5, y - 0.05 * s, Math.cos(a) * rad * 0.5], [0.32 * Math.cos(a), a, -0.32 * Math.sin(a)]);
        orb(pale, [Math.sin(a) * rad, y, Math.cos(a) * rad], [0.024 * s * (0.8 + (k % 3) * 0.12), 0.018 * s, 0.024 * s]);
        orb(body, [Math.sin(a) * rad + 0.012, y + 0.006, Math.cos(a) * rad], [0.009, 0.008, 0.009]);
      }
    } else if (arch === "spike") {
      // 唇形 / 总状：方茎、对生叶、轮伞花穗
      add(new THREE.CylinderGeometry(0.014, 0.02, 0.48 * s, 4), tint.setHex(leaf).offsetHSL(0, -0.04, -0.04).getHex(), [0, 0.24 * s, 0]);
      for (let j = 0; j < 4; j++) {
        const y = (0.12 + j * 0.09) * s, a = j * 1.55;
        petal(leaf, (0.17 - j * 0.018) * s, 0.05 * s, y, a, 0.3, 0.02);
        petal(leaf, (0.17 - j * 0.018) * s, 0.05 * s, y, a + Math.PI, 0.3, 0.02);
      }
      const rows = Math.round(7 * q);
      for (let r = 0; r < rows; r++) {
        const y = (0.4 + r * 0.042) * s, a = r * 0.8, spread = 0.03 + r * 0.003;
        for (let k = 0; k < 4; k++) {
          const ang = a + k * TAU / 4;
          orb(r === rows - 1 ? pale : body, [Math.sin(ang) * spread, y, Math.cos(ang) * spread],
            [0.016 * s, 0.013 * s, 0.016 * s]);
        }
      }
      orb(pale, [0, (0.4 + rows * 0.042) * s, 0], [0.026 * s, 0.032 * s, 0.026 * s]);
    } else if (arch === "head") {
      // 菊科：细茎、两圈大花瓣、颗粒花心
      add(new THREE.CylinderGeometry(0.012, 0.02, 0.42 * s, 7), tint.setHex(leaf).offsetHSL(0, -0.05, -0.02).getHex(), [0, 0.21 * s, 0]);
      petal(leaf, 0.2 * s, 0.07 * s, 0.12 * s, 0.3, 0.24);
      petal(leaf, 0.18 * s, 0.06 * s, 0.16 * s, 2.4, 0.28);
      const cy = 0.44 * s, rr = 0.1 * s;
      for (let k = 0; k < 14; k++) {
        const a = k * TAU / 14;
        petal(k % 3 ? body : tint.setHex(body).offsetHSL(0, 0, 0.12).getHex(), 0.2 * s * (0.92 + (k % 4) * 0.03), 0.045 * s, cy, a, 1.32, rr * 0.55);
      }
      for (let k = 0; k < 10; k++) {
        const a = k * TAU / 10 + 0.3;
        petal(tint.setHex(body).offsetHSL(0, -0.05, -0.06).getHex(), 0.12 * s, 0.04 * s, cy + 0.012, a, 1.18, rr * 0.5);
      }
      add(new THREE.SphereGeometry(1, 14, 10), herb === "honghua" ? 0xa8392a : 0xefc85a, [0, cy + 0.006, 0], [0, 0, 0], [0.055 * s, 0.024 * s, 0.055 * s]);
      for (let k = 0; k < 12; k++) {
        const a = k * 2.1, r2 = 0.02 + (k % 3) * 0.012;
        orb(0xffe08a, [Math.sin(a) * r2, cy + 0.024, Math.cos(a) * r2], [0.006, 0.005, 0.006]);
      }
      if (herb === "xuelian") {
        for (let k = 0; k < 14; k++) {
          const a = k * TAU / 14;
          petal(0xf4f7ef, 0.13 * s, 0.014, cy - 0.01, a, 1.5, rr * 0.8);
        }
      }
    } else if (arch === "vine") {
      // 藤本：折线藤茎攀架，心形叶，管状花
      let prev: Point = [0, 0.03, 0];
      for (let k = 0; k < 5; k++) {
        const a = k * 1.05;
        const next: Point = [Math.sin(a) * (0.1 + k * 0.03), (0.16 + k * 0.11) * s, Math.cos(a) * (0.1 + k * 0.03)];
        branch(prev, next, 0.009, 0.006, leaf);
        leafAt(leaf, 0.16 * s, 0.08 * s, next[0], next[1] - 0.015, next[2], 0.3, a + 1.1);
        leafAt(leaf, 0.15 * s, 0.075 * s, next[0], next[1] - 0.02, next[2], 0.3, a - 1.1);
        prev = next;
      }
      for (let k = 0; k < Math.round(4 * q); k++) {
        const a = k * 2.2 + 0.4, y = (0.28 + k * 0.095) * s;
        const x = Math.sin(a) * 0.13, z = Math.cos(a) * 0.13;
        add(new THREE.CylinderGeometry(0.009, 0.006, 0.11 * s, 6), pale, [x, y, z], [0.7, a, 0]);
        for (let j = 0; j < 5; j++) petal(k % 2 ? 0xf8f1c8 : pale, 0.055 * s, 0.02, y + 0.05 * s, a + j * TAU / 5, 1.2, 0.01);
        orb(0xf3d97a, [x, y + 0.055 * s, z], [0.008, 0.008, 0.008]);
      }
    } else if (arch === "bulb") {
      // 兰科：纺锤假鳞茎、线叶、顶生紫花
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3, x = Math.sin(a) * 0.045, z = Math.cos(a) * 0.045;
        orb(tint.setHex(leaf).offsetHSL(0, -0.1, 0.06).getHex(), [x, 0.12 * s + k * 0.02, z], [0.032 * s, 0.055 * s, 0.032 * s]);
        add(new THREE.CylinderGeometry(0.004, 0.005, 0.2 * s, 5), bark, [x, 0.24 * s, z], [0.1, a, 0.06]);
      }
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5 + 0.2;
        petal(leaf, 0.26 * s, 0.022, 0.28 * s, a, 0.55, 0.03);
      }
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1, y = 0.3 * s + (k % 2) * 0.02;
        for (let j = 0; j < 4; j++) petal(0xc98fd6, 0.075 * s, 0.026, y, a + j * TAU / 4, 1.1, 0.05);
        orb(0xf0d8f5, [Math.sin(a) * 0.05, y + 0.012, Math.cos(a) * 0.05], [0.014, 0.011, 0.014]);
      }
    } else if (arch === "tree") {
      // 矮乔木：主干、三枝上举、层叠冠叶与果实
      branch([0, 0, 0], [0, 0.72 * s, 0], 0.05, 0.032, bark);
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3 + 0.5;
        const tip: Point = [Math.sin(a) * 0.28 * s, 1.02 * s, Math.cos(a) * 0.28 * s];
        branch([0, 0.46 * s, 0], tip, 0.024, 0.012, bark);
        for (let j = 0; j < 5; j++) {
          const a2 = a + j * 1.3;
          leafAt(leaf, (0.2 + (j % 2) * 0.05) * s, 0.095 * s,
            tip[0] + Math.sin(a2) * 0.11 * s, tip[1] - 0.02 + (j % 3) * 0.03 * s, tip[2] + Math.cos(a2) * 0.11 * s,
            0.28, a2);
        }
        for (let j = 0; j < Math.round(4 * q); j++) {
          const a2 = a + 0.6 + j * 0.7;
          orb(j % 2 ? body : deep,
            [tip[0] + Math.sin(a2) * 0.07 * s, tip[1] - 0.05 * s - j * 0.028 * s, tip[2] + Math.cos(a2) * 0.07 * s],
            [0.022 * s, 0.025 * s, 0.022 * s]);
        }
      }
      if (herb === "juemingzi") {
        for (let k = 0; k < 4; k++) {
          const a = k * 1.6;
          branch([Math.sin(a) * 0.06, 0.32 * s, Math.cos(a) * 0.06],
            [Math.sin(a) * 0.16, 0.62 * s, Math.cos(a) * 0.16], 0.008, 0.008,
            tint.setHex(leaf).offsetHSL(0, 0.02, -0.05).getHex());
        }
      }
    } else if (arch === "aroid") {
      // 天南星 / 姜科：宽叶基生，佛焰苞裹肉穗
      for (let k = 0; k < 4; k++) {
        const a = k * TAU / 4 + 0.3;
        add(new THREE.CylinderGeometry(0.006, 0.01, 0.18 * s, 5), leaf, [Math.sin(a) * 0.03, 0.1 * s, Math.cos(a) * 0.03], [0.2, a, 0.1]);
        petal(leaf, (0.26 + (k % 2) * 0.05) * s, 0.13 * s, 0.2 * s, a, 0.35, 0.06);
      }
      add(new THREE.CylinderGeometry(0.02, 0.026, 0.26 * s, 7), 0xefe6cf, [0.02, 0.2 * s, -0.02], [0.1, 0.6, 0.06]);
      add(new THREE.CylinderGeometry(0.014, 0.018, 0.22 * s, 7), herb === "banxia" ? 0x8fae63 : 0xa8783e, [0.02, 0.21 * s, -0.02], [0.1, 0.6, 0.06]);
      petal(herb === "sharen" ? 0xd97c86 : 0xe8ecd8, 0.2 * s, 0.075 * s, 0.28 * s, 0.6, 0.9, 0.03);
      if (herb === "sharen") {
        for (let k = 0; k < 5; k++) {
          const y = (0.18 + k * 0.022) * s;
          orb(0xd4566a, [0.02, y, -0.02], [0.03 * s, 0.012 * s, 0.03 * s]);
        }
      }
    } else {
      // 香草：方茎、对生叶、顶轮伞小花
      add(new THREE.CylinderGeometry(0.011, 0.016, 0.42 * s, 4), tint.setHex(leaf).offsetHSL(0, 0.04, -0.02).getHex(), [0, 0.21 * s, 0]);
      for (let j = 0; j < 4; j++) {
        const y = (0.1 + j * 0.085) * s, a = j * 1.5 + 0.4;
        petal(leaf, (0.15 - j * 0.016) * s, 0.05 * s, y, a, 0.26, 0.02);
        petal(leaf, (0.15 - j * 0.016) * s, 0.05 * s, y, a + Math.PI, 0.26, 0.02);
      }
      const rows = Math.round(5 * q);
      for (let r = 0; r < rows; r++) {
        const y = (0.33 + r * 0.04) * s, a = r * 1.2, rad = 0.03 + r * 0.004;
        for (let k = 0; k < 5; k++) {
          const ang = a + k * TAU / 5;
          orb(r === rows - 1 ? pale : body, [Math.sin(ang) * rad, y, Math.cos(ang) * rad], [0.014, 0.011, 0.014]);
        }
      }
    }
  }

  if (stage === 0) {
    orb(0x9c6a47, [0, 0.025, 0], [0.17, 0.065, 0.14]);
    add(new THREE.SphereGeometry(1, 8, 5), 0xe5c493, [0, 0.074, 0], [0, 0, 0.35], [0.035, 0.047, 0.03]);
  } else if (stage === 1) {
    stem([0, 0.094, 0], 0.19, 0.023);
    leaves(2, 0.16, 0.21, 0.083, 0.07, 0.035, 0.6);
    leaves(2, 0.19, 0.105, 0.048, 0.045, 0.08, 2);
  } else if (CROPS[crop].herb) {
    herbModel(crop as HerbId, stage === 3);
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
        // 四枝一丛：三枝盛开一枝含苞，每枝基部两枚宽叶 + 茎 mid 一枚抱茎叶
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4 + 0.35, rad = 0.16 + (i % 2) * 0.05;
          const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
          const h = 0.62 + (i % 3) * 0.07, lean = 0.05 + (i % 2) * 0.03;
          const tx = x + Math.sin(a) * lean, tz = z + Math.cos(a) * lean;
          limb([x, 0, z], [x + Math.sin(a) * lean * 0.4, h * 0.55, z + Math.cos(a) * lean * 0.4], 0.024, 0.019);
          limb([x + Math.sin(a) * lean * 0.4, h * 0.55, z + Math.cos(a) * lean * 0.4], [tx, h, tz], 0.019, 0.014);
          add(foldedLeaf(0.46, 0.066, 0.2, 0.1), leaf, [x, 0.02, z], [0, a + 1.2, 0]);
          add(foldedLeaf(0.34, 0.055, 0.16, 0.13), leaf, [x, 0.02, z], [0, a + 2.7, 0]);
          add(foldedLeaf(0.26, 0.045, 0.12, 0.1), tint.setHex(leaf).offsetHSL(0, 0, 0.04).getHex(),
            [x + Math.sin(a) * lean * 0.3, h * 0.42, z + Math.cos(a) * lean * 0.3], [0, a + 0.4, 0]);
          if (ripe && i < 3) {
            const out = tint.setHex(body).offsetHSL(0, -0.01, 0.08).getHex();
            const inside = tint.setHex(body).offsetHSL(0, 0.06, -0.09).getHex();
            // 郁金香的杯形花冠：外三片先立起来微微外翻，内三片错开夹角再收紧
            for (let k = 0; k < 3; k++) {
              add(foldedLeaf(0.22, 0.1, 0.05, 0.014, false, true), out, [tx, h - 0.05, tz], [-1.25, a + k * TAU / 3, 0], [1, 1, 1], true);
            }
            for (let k = 0; k < 3; k++) {
              add(foldedLeaf(0.26, 0.085, 0.04, 0.006, false, true), inside, [tx, h - 0.04, tz], [-1.42, a + k * TAU / 3 + TAU / 6, 0], [1, 1, 1], true);
            }
            orb(0xf3d272, [tx, h - 0.03, tz], [0.018, 0.035, 0.018]);
          } else {
            const by = h - 0.03;
            orb(ripe ? tint.setHex(body).offsetHSL(0, 0, 0.05).getHex() : 0x8fbf6a, [tx, by, tz], [0.05, 0.085, 0.05]);
            for (let k = 0; k < 3; k++) add(foldedLeaf(0.12, 0.045, 0.03, 0.03), leaf, [tx, by + 0.01, tz], [-1.25, a + k * TAU / 3, 0]);
          }
        }
        break;
      }
      case "lily": {
        // 一茎三花：顶花 + 两条侧枝各托一朵，茎上五轮细叶铺满
        limb([0, 0, 0], [0.015, 0.5, 0], 0.03, 0.024);
        limb([0.015, 0.5, 0], [0, 0.92, 0], 0.024, 0.017);
        limb([0.01, 0.55, 0], [0.24, 0.74, 0.1], 0.016, 0.011);
        limb([0, 0.66, 0], [-0.22, 0.82, -0.08], 0.015, 0.01);
        for (let j = 0; j < 5; j++) leafNode([0.01 * (j % 2), 0.12 + j * 0.14, 0], 5, 0.3 - j * 0.02, 0.045, j * 0.7);
        leafNode([0.13, 0.63, 0.05], 2, 0.2, 0.035, 1.2);
        leafNode([-0.12, 0.73, -0.04], 2, 0.18, 0.032, 2.6);
        const lilyHead = (cx: number, cy: number, cz: number, s: number, tilt: number, yaw: number) => {
          const pale = tint.setHex(body).lerp(new THREE.Color(0xffffff), 0.42).getHex();
          const deep = tint.setHex(body).offsetHSL(0, 0.06, -0.02).getHex();
          // 六瓣百合：外三瓣先开，内三瓣错开收拢，瓣缘带褶
          for (let k = 0; k < 3; k++) {
            const a = yaw + k * TAU / 3 + 0.12;
            add(foldedLeaf(0.36 * s, 0.13 * s, 0.1 * s, 0.15 * s, false, true), pale,
              [cx + Math.sin(a) * 0.02 * s, cy, cz + Math.cos(a) * 0.02 * s], [tilt - 0.6, a, 0], [1, 1, 1], true);
          }
          for (let k = 0; k < 3; k++) {
            const a = yaw + k * TAU / 3 + TAU / 6 + 0.12;
            add(foldedLeaf(0.32 * s, 0.11 * s, 0.085 * s, 0.13 * s, false, true), deep,
              [cx + Math.sin(a) * 0.015 * s, cy + 0.02 * s, cz + Math.cos(a) * 0.015 * s], [tilt - 0.34, a, 0], [1, 1, 1], true);
          }
          // 花蕊：六根雄蕊带紫黄花药，中间一根雌蕊更长
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6 + 0.3;
            add(new THREE.CylinderGeometry(0.0028 * s, 0.004 * s, 0.2 * s, 4), 0xe8dfc6,
              [cx + Math.sin(a) * 0.05 * s, cy + 0.11 * s, cz + Math.cos(a) * 0.05 * s], [0.15 * Math.cos(a), 0, -0.15 * Math.sin(a)]);
            orb(0xc99a2c, [cx + Math.sin(a) * 0.074 * s, cy + 0.2 * s, cz + Math.cos(a) * 0.074 * s], [0.013 * s, 0.009 * s, 0.013 * s]);
          }
          add(new THREE.CylinderGeometry(0.0042 * s, 0.0055 * s, 0.24 * s, 4), 0xcfc2a0, [cx, cy + 0.13 * s, cz], [0, 0, 0]);
          orb(0xa99668, [cx, cy + 0.24 * s, cz], [0.012 * s, 0.016 * s, 0.012 * s]);
        };
        if (ripe) {
          lilyHead(0, 0.94, 0, 1, 0, 0.2);
          lilyHead(0.26, 0.76, 0.11, 0.8, -0.35, 1.1);
          lilyHead(-0.24, 0.84, -0.09, 0.72, -0.3, 2.4);
        } else {
          for (const [bx, by, bz, bs] of [[0, 0.94, 0, 1], [0.26, 0.76, 0.11, 0.8], [-0.24, 0.84, -0.09, 0.72]] as const) {
            orb(0xcfe0b8, [bx, by, bz], [0.05 * bs, 0.11 * bs, 0.05 * bs]);
            for (let k = 0; k < 3; k++) add(foldedLeaf(0.13 * bs, 0.052 * bs, 0.035 * bs, 0.05 * bs), leaf, [bx, by, bz], [-0.75, k * TAU / 3, 0]);
          }
        }
        break;
      }
      case "roseRed":
      case "rosePink":
      case "roseWhite":
      case "roseYellow":
      case "roseBlue":
      case "rosePurple": {
        // 一丛三花：主茎顶花 + 两条侧枝各托一朵，茎上五节羽状复叶
        limb([0, 0, 0], [0.02, 0.45, 0], 0.034, 0.027);
        limb([0.02, 0.45, 0], [0, 0.92, 0], 0.027, 0.019);
        limb([0.015, 0.4, 0], [0.26, 0.62, 0.1], 0.017, 0.012);
        limb([0.005, 0.56, 0], [-0.24, 0.78, -0.08], 0.016, 0.011);
        for (let j = 0; j < 5; j++) {
          const y = 0.16 + j * 0.16, yaw = j * 1.35;
          // 羽状复叶：顶生小叶 + 两侧各一枚侧小叶
          leafNode([0.01 * (j % 2), y, 0], 3, 0.17 - j * 0.012, 0.055, yaw, 0.12);
        }
        leafNode([0.14, 0.5, 0.05], 2, 0.13, 0.045, 1.2, 0.12);
        leafNode([-0.13, 0.66, -0.04], 2, 0.12, 0.042, 2.6, 0.12);
        const roseHead = (cx: number, cy: number, cz: number, s: number, yaw: number) => {
          const inner = tint.setHex(body).offsetHSL(0, 0.03, -0.08).getHex();
          const mid = tint.setHex(body).offsetHSL(0, 0.01, 0.02).getHex();
          const outer = tint.setHex(body).offsetHSL(0, -0.02, 0.14).getHex();
          // 花萼五片，向下外翻托在花底下
          for (let k = 0; k < 5; k++) add(foldedLeaf(0.08 * s, 0.028 * s, 0.02 * s, -0.015 * s), leaf, [cx, cy - 0.035 * s, cz], [2.75, yaw + k * TAU / 5 + 0.2, 0], [1, 1, 1], true);
          // 三层花瓣由外向内一层层收，外圈最开、内圈几乎包成花心
          for (let k = 0; k < 8; k++) add(foldedLeaf(0.23 * s, 0.115 * s, 0.12 * s, 0.05 * s, false, true), outer, [cx, cy, cz], [-0.8, yaw + k * TAU / 8, 0], [1, 1, 1], true);
          for (let k = 0; k < 6; k++) add(foldedLeaf(0.19 * s, 0.098 * s, 0.1 * s, 0.04 * s, false, true), mid, [cx, cy + 0.025 * s, cz], [-0.55, yaw + k * TAU / 6 + 0.28, 0], [1, 1, 1], true);
          for (let k = 0; k < 4; k++) add(foldedLeaf(0.15 * s, 0.082 * s, 0.09 * s, 0.03 * s, false, true), inner, [cx, cy + 0.045 * s, cz], [-0.35, yaw + k * TAU / 4 + 0.6, 0], [1, 1, 1], true);
          // 最内层三瓣几乎竖直抱合，旋出玫瑰花心，而不是一颗露出的果球
          for (let k = 0; k < 3; k++) add(foldedLeaf(0.1 * s, 0.06 * s, 0.07 * s, 0.02 * s, false, true), inner, [cx, cy + 0.055 * s, cz], [-0.16, yaw + k * TAU / 3 + 1.0, 0], [1, 1, 1], true);
          orb(inner, [cx, cy + 0.05 * s, cz], [0.012 * s, 0.016 * s, 0.012 * s]);
        };
        if (ripe) {
          roseHead(0, 0.95, 0, 1, 0.2);
          roseHead(0.28, 0.66, 0.12, 0.8, 1.1);
          roseHead(-0.26, 0.82, -0.1, 0.72, 2.4);
        } else {
          for (const [bx, by, bz, bs] of [[0, 0.92, 0, 1], [0.28, 0.64, 0.12, 0.8], [-0.26, 0.8, -0.1, 0.72]] as const) {
            orb(0x8fbf6a, [bx, by, bz], [0.05 * bs, 0.07 * bs, 0.05 * bs]);
            for (let k = 0; k < 3; k++) add(foldedLeaf(0.09 * bs, 0.03 * bs, 0.012 * bs, -0.015 * bs), leaf, [bx, by - 0.02 * bs, bz], [-0.7, k * TAU / 3, 0]);
          }
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
    if (mutation && ripe && !isWildMutation(mutation) && !flower) {
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
  // 草药变异：仙品做玉质冷白渐变，神品整株向金黄压深（闪电与云雾交给特效层）
  if ((mutation === "xianpin" || mutation === "shenpin") && !flower) {
    const out = new THREE.Color();
    const root = new THREE.Color(mutation === "xianpin" ? 0xa9d8c2 : 0xb07c22);
    const tip = new THREE.Color(mutation === "xianpin" ? 0xfdfdff : 0xffe884);
    recolorVertices(merged, (_x, y, _z, base) => {
      const t = smoothstep(0, 0.5, y);
      return out.copy(root).lerp(tip, 0.35 + 0.55 * t).multiplyScalar(0.9 + 0.14 * base.g + 0.04 * Math.sin(y * 22));
    });
  }
  // 野菜变异是整株材质变化：阴阳按左右双分，长生做玉质渐变，生长期也可见
  if (mutation && isWildMutation(mutation) && !flower) {
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
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0,
    clearcoat: 0.18, clearcoatRoughness: 0.6,
  });
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
