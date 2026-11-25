import * as THREE from "three";
import { MUTATIONS, isWildMutation, type Mutation } from "../game/weather";
import { cloudTexture, softDotTexture } from "./wildAuras";

/**
 * 普通作物变异（元素 / 精灵）的柔光特效：与野菜变异同一套语言——
 * 大面积低透明度云絮、升腾的雾、细小光尘、慢速呼吸光晕。
 * 不再使用图标 glyphs 与十字芒线条；每种变异只改配色与运动配方。
 */

/** [升雾, 环云, 光尘, 飘落, 速度] —— 决定每种变异的气质 */
const RECIPES: Record<string, [number, number, number, number, number]> = {
  thunder: [10, 4, 12, 0, 1.6],
  frost: [4, 6, 4, 12, 0.5],
  flame: [16, 4, 8, 0, 1.25],
  gold: [6, 12, 8, 0, 0.8],
  earth: [14, 6, 4, 0, 0.6],
  wind: [4, 14, 6, 0, 1.4],
  rosette: [12, 8, 6, 0, 0.8],
  nocturne: [4, 12, 6, 0, 0.55],
  coral: [6, 10, 4, 6, 0.7],
  orbit: [4, 12, 8, 0, 1.1],
  bamboo: [12, 8, 4, 0, 0.75],
  // 草药五行：金疏朗、木柔绿、水雾重、火升腾、土沉稳
  herbMetal: [8, 10, 14, 0, 0.7],
  herbWood: [10, 8, 10, 0, 0.6],
  herbWater: [8, 14, 12, 0, 0.9],
  herbFire: [14, 6, 16, 0, 1.1],
  herbEarth: [16, 6, 6, 0, 0.5],
  // 仙品：云雾绕株、光尘不停；神品：金尘上涌 + 落雷
  xianpin: [18, 16, 26, 0, 0.42],
  shenpin: [12, 10, 30, 0, 1.0],
};
function recipeOf(mutation: Mutation) {
  const key = mutation === "amber" ? "gold" : mutation === "mist" ? "wind" : mutation === "pearl" ? "coral" : mutation;
  return RECIPES[key] ?? RECIPES.gold;
}

const MIST_VERTEX = `
  uniform float t, pixelScale;
  attribute vec3 aCenter, aColor;
  attribute float aSeed, aSize, aMode, aSpeed;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float life = fract(t * (0.09 + aSeed * 0.05) * aSpeed + aSeed * 7.31);
    float ang = aSeed * 6.2831 + t * (0.22 + aSeed * 0.18) * aSpeed;
    vec3 p = aCenter;
    if (aMode < 0.5) {
      float r = 0.14 + 0.34 * life;
      p += vec3(cos(ang) * r, 0.06 + life * 0.9, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.46;
    } else if (aMode < 1.5) {
      float r = 0.44 + 0.1 * sin(t * 0.4 + aSeed * 9.0);
      p += vec3(cos(ang) * r, 0.24 + 0.16 * sin(t * 0.6 + aSeed * 12.0), sin(ang) * r);
      vAlpha = 0.26 + 0.1 * sin(t * 0.7 + aSeed * 20.0);
    } else if (aMode < 2.5) {
      float r = 0.1 + 0.24 * aSeed;
      p += vec3(cos(ang * 1.7) * r, 0.08 + life * 1.5, sin(ang * 1.7) * r);
      vAlpha = sin(life * 3.14159) * 0.6;
    } else if (aMode < 3.5) {
      // 霜 / 珠：从冠层慢慢飘落、化开
      float r = 0.16 + 0.3 * aSeed;
      p += vec3(cos(ang) * r, 0.95 - life * 0.85, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.42;
    } else if (aMode < 4.5) {
      // 仙品：贴地的云雾团绕着植株缓慢游走，边转边呼吸
      float r = 0.24 + 0.16 * aSeed + 0.04 * sin(t * 0.32 + aSeed * 5.0);
      p += vec3(cos(ang * 0.55) * r, 0.14 + 0.1 * sin(t * 0.36 + aSeed * 8.0) + life * 0.3, sin(ang * 0.55) * r);
      vAlpha = 0.2 + 0.16 * sin(t * 0.45 + aSeed * 11.0);
    } else {
      // 仙品 / 神品：植株表面碎光，高频闪烁
      float r = 0.08 + 0.2 * aSeed;
      p += vec3(cos(ang * 2.1) * r, 0.1 + 0.7 * aSeed + 0.04 * sin(t * 0.8 + aSeed * 6.0), sin(ang * 2.1) * r);
      vAlpha = 0.24 + 0.55 * pow(max(0.0, sin(t * 2.6 + aSeed * 30.0)), 6.0);
    }
    vColor = aColor;
    vec4 eye = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * eye;
    float swell = aMode < 1.5 ? 0.7 + 0.6 * life : (aMode > 3.5 && aMode < 4.5 ? 0.85 + 0.55 * life : 1.0);
    gl_PointSize = clamp(pixelScale * aSize * swell / max(1.0, -eye.z), 2.0, 260.0);
  }`;
const MIST_FRAGMENT = `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(map, gl_PointCoord).a * vAlpha;
    if (a < 0.015) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

interface PlotAura {
  mutation: Mutation;
  stage: number;
  halos: THREE.Sprite[];
  bolts: THREE.Sprite[];
  /** 野外草药丛没有固定地块，中心点随每次生成传入 */
  center?: THREE.Vector3;
  /** 光效强度倍率：鲜花变异不改花色，只把光晕/粒子加强 */
  boost?: number;
}

/** 神品落雷：程序化画出分叉闪电的柔光贴图（多层描边 + 阴影模糊），避免用折线几何硬拼 */
let boltTex: THREE.CanvasTexture | null = null;
function boltTexture() {
  if (boltTex) return boltTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 512);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rng = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const stroke = (points: number[][], width: number, color: string, glow: number, dash = 0, offset = 0) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = "rgba(255,206,112,0.85)";
    ctx.shadowBlur = glow;
    if (dash) { ctx.setLineDash([dash, dash * 0.42]); ctx.lineDashOffset = offset; }
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const branch = (seed: number, x0: number, y0: number, len: number, dir: number, depth: number, out: number[][]) => {
    const next = rng(seed);
    let x = x0, y = y0, a = dir;
    for (let i = 0; i < 15; i++) {
      // 大角度折返，让主干是真正的锯齿而不是柔顺弧线
      a += (next() - 0.5) * 1.9 + (i % 4 === 0 ? (next() - 0.5) * 1.1 : 0);
      const step = len / 15;
      x += Math.sin(a) * step;
      y -= Math.cos(a) * step;
      out.push([x, y]);
    }
    if (depth > 0) {
      for (let b = 0; b < 2; b++) {
        const at = out[Math.floor(out.length * (0.35 + next() * 0.5))];
        branch(seed + 31 + b * 7, at[0], at[1], len * (0.4 + next() * 0.22), a + (b ? 1.1 : -1.0), depth - 1, out);
      }
    }
  };
  for (let k = 0; k < 2; k++) {
    const pts: number[][] = [[128 + (k ? 24 : -18), 508]];
    branch(17 + k * 91, 128 + (k ? 24 : -18), 508, 450, (k ? 0.14 : -0.1), 2, pts);
    // 分段断开画，避免连续描边糊成一道光柱；芯线不加模糊保持锯齿
    stroke(pts, 12, "rgba(255,196,88,0.2)", 12, 26, k * 17);
    stroke(pts, 4, "rgba(255,231,150,0.8)", 3, 30, k * 31);
    stroke(pts, 2, "rgba(255,252,232,0.96)", 0, 34, k * 46);
  }
  boltTex = new THREE.CanvasTexture(canvas);
  boltTex.colorSpace = THREE.SRGBColorSpace;
  return boltTex;
}

/** 全部菜地共用一次绘制；阶段 / 变异变化时重建该地块的柔光配方。 */
export function createCropAuras(centers: THREE.Vector3[] | ((id: number) => THREE.Vector3 | undefined)) {
  const centerOf = (id: number) => (typeof centers === "function" ? centers(id) : centers[id]);
  const group = new THREE.Group();
  group.name = "crop-mutation-auras";
  const dot = softDotTexture();
  const cloud = cloudTexture();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
  const uniforms = { t: { value: 0 }, pixelScale: { value: 240 }, map: { value: cloud } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: MIST_VERTEX, fragmentShader: MIST_FRAGMENT,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  group.add(points);

  const plots = new Map<number, PlotAura>();
  const white = new THREE.Color(0xffffff);

  function rebuild() {
    const rows: number[][] = [];
    for (const [id, aura] of plots) {
      const center = aura.center ?? centerOf(id);
      if (!center) continue;
      const b = aura.boost ?? 1;
      const [rise0, orbit0, dust0, fall0, speed] = recipeOf(aura.mutation);
      const rise = Math.round(rise0 * b), orbit = Math.round(orbit0 * b);
      const dust = Math.round(dust0 * b), fall = Math.round(fall0 * b);
      const fruit = new THREE.Color(MUTATIONS[aura.mutation].fruit);
      const puff = fruit.clone().lerp(white, 0.45);
      const cloudTint = fruit.clone().lerp(white, 0.7);
      const mote = fruit.clone().lerp(white, 0.25);
      const flake = fruit.clone().lerp(white, 0.6);
      const s = (0.55 + 0.45 * Math.min(1, 0.18 + aura.stage * 0.28)) * b;
      const c = center.clone();
      c.y += 0.1;
      const seedBase = (id * 0.618) % 1;
      const push = (color: THREE.Color, size: number, mode: number, i: number) => {
        rows.push([c.x, c.y, c.z, color.r, color.g, color.b, size * s, mode, (seedBase + i * 0.271) % 1, speed]);
      };
      for (let i = 0; i < rise; i++) push(puff, 1.5 + (i % 3) * 0.4, 0, i);
      for (let i = 0; i < orbit; i++) push(cloudTint, 1.7 + (i % 3) * 0.5, 1, i + 40);
      for (let i = 0; i < dust; i++) push(mote, 0.34, 2, i + 80);
      for (let i = 0; i < fall; i++) push(flake, 0.5 + (i % 2) * 0.2, 3, i + 120);
      if (aura.mutation === "xianpin") {
        // 云雾绕株：贴地大团慢雾 + 植株表面碎光
        for (let i = 0; i < 14; i++) push(cloudTint, 3.0 + (i % 3) * 0.6, 4, i + 200);
        for (let i = 0; i < 22; i++) push(white.clone().lerp(fruit, 0.22), 0.3 + (i % 3) * 0.07, 5, i + 240);
      } else if (aura.mutation === "shenpin") {
        // 神品：金黄碎光高频闪烁
        for (let i = 0; i < 26; i++) push(new THREE.Color(0xffe9a0), 0.3 + (i % 3) * 0.08, 5, i + 300);
      }
    }
    const count = rows.length;
    const position = new Float32Array(count * 3);
    const aCenter = new Float32Array(count * 3);
    const aColor = new Float32Array(count * 3);
    const aSeed = new Float32Array(count);
    const aSize = new Float32Array(count);
    const aMode = new Float32Array(count);
    const aSpeed = new Float32Array(count);
    rows.forEach((row, i) => {
      aCenter.set(row.slice(0, 3), i * 3);
      aColor.set(row.slice(3, 6), i * 3);
      aSize[i] = row[6];
      aMode[i] = row[7];
      aSeed[i] = row[8];
      aSpeed[i] = row[9];
    });
    geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geo.setAttribute("aCenter", new THREE.BufferAttribute(aCenter, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute("aMode", new THREE.BufferAttribute(aMode, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
    points.visible = count > 0;
  }

  function rebuildHalos() {
    for (const aura of plots.values()) {
      aura.halos.forEach(h => { h.material.dispose(); h.removeFromParent(); });
      aura.bolts.forEach(b => { b.material.dispose(); b.removeFromParent(); });
      aura.halos = [];
      aura.bolts = [];
    }
    for (const [id, aura] of plots) {
      const center = aura.center ?? centerOf(id);
      if (!center) continue;
      const fruit = new THREE.Color(MUTATIONS[aura.mutation].fruit);
      const b = aura.boost ?? 1;
      const s = (0.55 + 0.45 * Math.min(1, 0.18 + aura.stage * 0.28)) * b;
      const add = (color: THREE.Color, opacity: number, size: number, y: number) => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dot, color, transparent: true, opacity: Math.min(0.42, opacity * b), blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        sprite.position.set(center.x, center.y + y * s, center.z);
        sprite.scale.setScalar(size * s);
        sprite.userData.baseScale = size * s;
        sprite.userData.baseOpacity = opacity;
        group.add(sprite);
        aura.halos.push(sprite);
      };
      add(fruit.clone().lerp(white, 0.3), 0.2, 1.6, 0.4);
      add(fruit.clone().lerp(white, 0.7), 0.16, 0.9, 0.16);
      if (aura.mutation === "xianpin") {
        // 仙品：玉白冷光大晕 + 贴冠层的小亮斑
        add(new THREE.Color(0xe8f4ff), 0.26, 2.05, 0.5);
        add(new THREE.Color(0xffffff), 0.2, 0.72, 0.78);
      }
      if (aura.mutation === "shenpin") {
        for (let k = 0; k < 3; k++) {
          const a = k * Math.PI * 2 / 3 + 0.4;
          const bolt = new THREE.Sprite(new THREE.SpriteMaterial({
            map: boltTexture(), color: 0xfff0c0, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
          }));
          bolt.position.set(center.x + Math.sin(a) * 0.3 * s, center.y + 1.15 * s, center.z + Math.cos(a) * 0.3 * s);
          bolt.scale.set(1.0 * s, 2.3 * s, 1);
          bolt.userData.baseX = 1.0 * s;
          bolt.userData.baseY = 2.3 * s;
          bolt.userData.seed = k * 0.31;
          bolt.renderOrder = 3;
          group.add(bolt);
          aura.bolts.push(bolt);
        }
      }
    }
  }

  return {
    group,
    setTime(t: number) {
      uniforms.t.value = t;
      uniforms.pixelScale.value = Math.min(330, window.innerHeight * 0.43);
      for (const aura of plots.values()) {
        for (const halo of aura.halos) {
          const breath = 1 + 0.09 * Math.sin(t * 0.8 + halo.position.x);
          halo.scale.setScalar((halo.userData.baseScale as number) * breath);
          halo.material.opacity = (halo.userData.baseOpacity as number) * (0.85 + 0.15 * Math.sin(t * 0.9 + halo.position.z));
        }
        for (const bolt of aura.bolts) {
          const seed = bolt.userData.seed as number;
          const cyc = (t * 0.5 + seed) % 1;
          const flash = cyc < 0.11 ? Math.sin((cyc / 0.11) * Math.PI) : 0;
          bolt.material.opacity = 0.26 + 0.62 * flash;
          const jitter = 1 + 0.015 * Math.sin(t * 24 + seed * 9);
          bolt.scale.set((bolt.userData.baseX as number) * jitter,
            (bolt.userData.baseY as number) * (1 + 0.035 * flash), 1);
        }
      }
    },
    setPlot(id: number, mutation: Mutation | null, stage: number, center?: THREE.Vector3, boost = 1) {
      const existing = plots.get(id);
      // 野菜变异走 wildAuras 的黑白雾 / 玉云，这里不叠加
      if (!mutation || stage < 0 || isWildMutation(mutation)) {
        if (existing) {
          existing.halos.forEach(h => { h.material.dispose(); h.removeFromParent(); });
          existing.bolts.forEach(b => { b.material.dispose(); b.removeFromParent(); });
          plots.delete(id);
          rebuild();
        }
        return;
      }
      if (existing && existing.mutation === mutation && existing.stage === stage && (existing.boost ?? 1) === boost
        && (!center || !existing.center || existing.center.distanceToSquared(center) < 1e-4)) return;
      if (existing) existing.halos.forEach(h => { h.material.dispose(); h.removeFromParent(); });
      if (existing) existing.bolts.forEach(b => { b.material.dispose(); b.removeFromParent(); });
      plots.set(id, { mutation, stage, halos: [], bolts: [], center, boost });
      rebuild();
      rebuildHalos();
    },
    dispose() {
      for (const aura of plots.values()) {
        aura.halos.forEach(h => h.material.dispose());
        aura.bolts.forEach(b => b.material.dispose());
      }
      plots.clear();
      geo.dispose();
      mat.dispose();
      dot.dispose();
      cloud.dispose();
      boltTex?.dispose();
      boltTex = null;
      group.clear();
    },
  };
}