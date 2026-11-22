import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { wildMutationFamily, wildMutationTier, type WildMutation } from "../game/weather";

/**
 * 野菜专属变异特效：阴阳（黑白双雾 + 星辰环绕）与长生（玉质云雾 + 金龙环绕）。
 * 原则：夸张但柔和——大面积低透明度柔光粒子、慢速呼吸，不用亮线条堆砌。
 * 星辰数 / 金龙数 = 变异级别（1–3）。
 */

const TAU = Math.PI * 2;

function hash(key: string) {
  let n = 2166136261;
  for (const char of key) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

/** 纯径向渐变的柔光点 */
export function softDotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(255,255,255,0.16)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 几团柔光叠成的云絮 */
export function cloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const blobs = [[64, 64, 46], [40, 52, 30], [88, 56, 32], [52, 84, 28], [80, 82, 26]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.6, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 太阳星辰：大日冕 + 八道长短金芒 + 炽白核，边缘全部羽化 */
function starTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(128, 128);
  // 外日冕：一圈暖金，给星辰托底，远看也有分量
  const corona = ctx.createRadialGradient(0, 0, 14, 0, 0, 128);
  corona.addColorStop(0, "rgba(255,255,255,0.62)");
  corona.addColorStop(0.24, "rgba(255,242,198,0.4)");
  corona.addColorStop(0.58, "rgba(255,214,124,0.15)");
  corona.addColorStop(1, "rgba(255,198,84,0)");
  ctx.fillStyle = corona;
  ctx.fillRect(-128, -128, 256, 256);
  // 芒：主芒长而粗、副芒短、细芒补空隙
  const spikes = (count: number, baseAngle: number, len: number, halfW: number, alpha: number) => {
    for (let k = 0; k < count; k++) {
      ctx.save();
      ctx.rotate(baseAngle + (k * Math.PI * 2) / count);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.5, `rgba(255,246,212,${alpha * 0.52})`);
      g.addColorStop(1, "rgba(255,224,142,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.quadraticCurveTo(-halfW * 0.45, -len * 0.56, 0, -len);
      ctx.quadraticCurveTo(halfW * 0.45, -len * 0.56, halfW, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
  spikes(4, 0, 126, 16, 1);
  spikes(4, Math.PI / 4, 78, 11, 0.86);
  spikes(4, Math.PI / 8, 46, 6, 0.62);
  // 炽白核心：太阳的亮核又小又硬
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.4, "rgba(255,253,236,0.94)");
  core.addColorStop(1, "rgba(255,226,150,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 龙鳞：交错排列的盾形鳞片，亮顶暗底，铺满整张，可直接乘到龙体的顶点色上 */
function scaleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  const cols = 6, rows = 6, w = 192 / cols, h = 192 / rows;
  const drawScale = (x: number, y: number) => {
    const g = ctx.createLinearGradient(x, y - h * 0.5, x, y + h * 0.58);
    g.addColorStop(0, "#fffdf4");
    g.addColorStop(0.42, "#ffe8ad");
    g.addColorStop(1, "#aa8636");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - h * 0.08);
    ctx.quadraticCurveTo(x - w * 0.44, y + h * 0.54, x, y + h * 0.56);
    ctx.quadraticCurveTo(x + w * 0.44, y + h * 0.54, x + w * 0.5, y - h * 0.08);
    ctx.quadraticCurveTo(x, y - h * 0.52, x - w * 0.5, y - h * 0.08);
    ctx.fill();
    ctx.strokeStyle = "rgba(52,36,10,0.5)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // 每片鳞上缘留一道白高光，龙一动就有一排排碎闪
    ctx.strokeStyle = "rgba(255,255,255,0.46)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.14);
    ctx.quadraticCurveTo(x, y - h * 0.36, x + w * 0.3, y - h * 0.14);
    ctx.stroke();
  };
  ctx.fillStyle = "#aa8636";
  ctx.fillRect(0, 0, 192, 192);
  // 四周各补一圈，平铺时鳞片不会断在半路
  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      drawScale(col * w + (row % 2 ? w * 0.5 : 0), row * h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MIST_VERTEX = `
  uniform float t, pixelScale;
  attribute vec3 aCenter, aColor;
  attribute float aSeed, aSize, aMode;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float life = fract(t * (0.09 + aSeed * 0.05) + aSeed * 7.31);
    float ang = aSeed * 6.2831 + t * (0.22 + aSeed * 0.18);
    vec3 p = aCenter;
    if (aMode < 0.5) {
      // 升腾的雾：从根部一圈慢慢升起、散开
      float r = 0.14 + 0.34 * life;
      p += vec3(cos(ang) * r, 0.06 + life * 0.9, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.5;
    } else if (aMode < 1.5) {
      // 环绕的云：缓慢公转、上下轻浮
      float r = 0.44 + 0.1 * sin(t * 0.4 + aSeed * 9.0);
      p += vec3(cos(ang) * r, 0.24 + 0.16 * sin(t * 0.6 + aSeed * 12.0), sin(ang) * r);
      vAlpha = 0.3 + 0.12 * sin(t * 0.7 + aSeed * 20.0);
    } else {
      // 细小的光尘：升得更高
      float r = 0.1 + 0.24 * aSeed;
      p += vec3(cos(ang * 1.7) * r, 0.08 + life * 1.5, sin(ang * 1.7) * r);
      vAlpha = sin(life * 3.14159) * 0.7;
    }
    vColor = aColor;
    vec4 eye = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * eye;
    float swell = aMode < 1.5 ? 0.7 + 0.6 * life : 1.0;
    gl_PointSize = clamp(pixelScale * aSize * swell / max(1.0, -eye.z), 2.0, 260.0);
  }`;
const MIST_FRAGMENT = `
  uniform sampler2D map;
  uniform float opacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(map, gl_PointCoord).a * vAlpha * opacity;
    if (a < 0.015) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

interface Star {
  sprite: THREE.Sprite;
  halo: THREE.Sprite;
}

interface Emitter {
  key: string;
  center: THREE.Vector3;
  mutation: WildMutation;
  scale: number;
  phase: number;
  visuals: THREE.Group;
  halos: THREE.Sprite[];
  stars: Star[];
  dragons: Dragon[];
}

interface Dragon {
  group: THREE.Group;
  glow: THREE.Sprite;
  direction: 1 | -1;
  offset: number;
  swim: (headAngle: number, t: number, center: THREE.Vector3, scale: number) => void;
  dispose: () => void;
}

export function createWildAuras() {
  const group = new THREE.Group();
  group.name = "wild-mutation-auras";
  const dot = softDotTexture();
  const cloud = cloudTexture();
  const star = starTexture();

  const emitters = new Map<string, Emitter>();
  let dirty = true;

  // —— 两套粒子：加色柔光（白雾/玉云/光尘）与普通混合的暗雾 ——
  function makePoints(map: THREE.Texture, blending: THREE.Blending, opacity: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    const uniforms = { t: { value: 0 }, pixelScale: { value: 240 }, map: { value: map }, opacity: { value: opacity } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending, toneMapped: false,
      vertexShader: MIST_VERTEX, fragmentShader: MIST_FRAGMENT,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 3;
    group.add(points);
    return { geo, uniforms, points };
  }
  const glow = makePoints(cloud, THREE.AdditiveBlending, 1);
  const dark = makePoints(cloud, THREE.NormalBlending, 0.5);

  function rebuildParticles() {
    const glowRows: number[][] = [];
    const darkRows: number[][] = [];
    const push = (rows: number[][], center: THREE.Vector3, color: THREE.Color, size: number, mode: number, seed: number) => {
      rows.push([center.x, center.y, center.z, color.r, color.g, color.b, size, mode, seed]);
    };
    for (const emitter of emitters.values()) {
      const { center, mutation, scale, phase } = emitter;
      const tier = wildMutationTier(mutation);
      const c = center.clone();
      c.y += 0.1 * scale;
      if (wildMutationFamily(mutation) === "yinyang") {
        const white = new THREE.Color(0xf5f2ea);
        const ink = new THREE.Color(0x1c1c26);
        const mote = new THREE.Color(0xdfe4f2);
        const right = c.clone().add(new THREE.Vector3(0.15 * scale, 0, 0));
        const left = c.clone().add(new THREE.Vector3(-0.15 * scale, 0, 0));
        const puffs = 18 + tier * 6;
        for (let i = 0; i < puffs; i++) {
          const seed = phase + i * 0.618;
          push(glowRows, right, white, (1.5 + (i % 3) * 0.4) * scale, 0, seed);
          push(darkRows, left, ink, (1.5 + (i % 3) * 0.4) * scale, 0, seed + 0.37);
        }
        for (let i = 0; i < 6 + tier * 2; i++) push(glowRows, c, mote, 0.34 * scale, 2, phase + i * 0.271);
      } else {
        const jade = new THREE.Color(0x9fdcb8);
        const pale = new THREE.Color(0xd6f5e2);
        const gold = new THREE.Color(0xf2cf7a);
        const clouds = 20 + tier * 6;
        for (let i = 0; i < clouds; i++) {
          push(glowRows, c, i % 2 ? jade : pale, (1.7 + (i % 3) * 0.5) * scale, 1, phase + i * 0.618);
        }
        for (let i = 0; i < 8 + tier * 3; i++) push(glowRows, c, gold, 0.36 * scale, 2, phase + i * 0.271);
      }
    }
    for (const [system, rows] of [[glow, glowRows], [dark, darkRows]] as const) {
      const count = rows.length;
      const position = new Float32Array(count * 3);
      const aCenter = new Float32Array(count * 3);
      const aColor = new Float32Array(count * 3);
      const aSeed = new Float32Array(count);
      const aSize = new Float32Array(count);
      const aMode = new Float32Array(count);
      rows.forEach((row, i) => {
        aCenter.set(row.slice(0, 3), i * 3);
        aColor.set(row.slice(3, 6), i * 3);
        aSize[i] = row[6];
        aMode[i] = row[7];
        aSeed[i] = row[8] % 1;
      });
      system.geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
      system.geo.setAttribute("aCenter", new THREE.BufferAttribute(aCenter, 3));
      system.geo.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
      system.geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
      system.geo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
      system.geo.setAttribute("aMode", new THREE.BufferAttribute(aMode, 1));
      system.points.visible = count > 0;
    }
  }

  // —— 金龙：三渲二（赛璐璐）工艺。
  //    形：环带管连续躯体（颈弓起、胸腔鼓、尾收细）+ 平滑头饰（鹿角 / 须髯 / 颊鳍）
  //        + 四爪 + 尾鳍 + 背鳍，全部平滑小件合并，无球节拼缝。
  //    渲：3 阶硬边色阶卡通材质 + 顶点色（腹甲横纹 / 背脊高光）+ 背面扩壳描边
  //        + 一层鳞纹壳（贴在体表外 3mm）+ 一层加法混合的金光壳（呼吸发亮）。 ——
  const RINGS = 44, RADIAL = 12, STEP = 0.042;
  const toonRamp = new THREE.DataTexture(new Uint8Array([92, 166, 226, 255]), 4, 1, THREE.RedFormat);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.generateMipmaps = false;
  toonRamp.needsUpdate = true;
  // 身体单独用一档更亮的色阶：逆境里也要看出金，而不是一团土褐
  const bodyRamp = new THREE.DataTexture(new Uint8Array([152, 206, 240, 255]), 4, 1, THREE.RedFormat);
  bodyRamp.minFilter = bodyRamp.magFilter = THREE.NearestFilter;
  bodyRamp.generateMipmaps = false;
  bodyRamp.needsUpdate = true;
  const dragonToon = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: toonRamp,
    emissive: new THREE.Color(0xffab3e), emissiveIntensity: 0.2,
  });
  const bodyToon = new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: bodyRamp,
    emissive: new THREE.Color(0xffc25a), emissiveIntensity: 0.85,
  });
  const dragonFinMat = new THREE.MeshToonMaterial({
    vertexColors: true, side: THREE.DoubleSide, gradientMap: toonRamp,
    emissive: new THREE.Color(0xff9a34), emissiveIntensity: 0.24,
  });
  // 描边：共享几何 + 顶点法线外扩（背面壳），每帧跟管体变形自动贴合
  const OUTLINE_VERTEX = `
    uniform float width;
    void main() {
      vec3 p = position + normal * width;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const OUTLINE_FRAGMENT = `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`;
  /** 带 UV 的外扩壳：鳞纹层与金光层共用，贴着体表往外挪几毫米 */
  const SHELL_VERTEX = `
    uniform float width;
    varying vec2 vUv;
    void main() {
      vec3 p = position + normal * width;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const SCALE_FRAGMENT = `
    uniform sampler2D map;
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      float a = texture2D(map, vUv).a;
      if (a < 0.1) discard;
      gl_FragColor = vec4(color, a * opacity);
    }`;
  const GLOW_FRAGMENT = `
    uniform vec3 color;
    uniform float opacity;
    void main() { gl_FragColor = vec4(color, opacity); }`;
  const outlineColor = new THREE.Color(0x543609);
  function makeOutline(width: number) {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: true,
      uniforms: { width: { value: width }, color: { value: outlineColor } },
      vertexShader: OUTLINE_VERTEX, fragmentShader: OUTLINE_FRAGMENT,
    });
  }
  const detailOutlineMat = makeOutline(0.010);
  const bodyOutlineMat = makeOutline(0.010);
  const scaleTex = scaleTexture();
  // 鳞片直接乘进龙体本身的漫反射，近看是排排金鳞，不靠线宽
  bodyToon.map = scaleTex;
  const scaleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: {
      width: { value: 0.0035 }, map: { value: scaleTex },
      color: { value: new THREE.Color(0x6b4a19) }, opacity: { value: 0.8 },
    },
    vertexShader: SHELL_VERTEX, fragmentShader: SCALE_FRAGMENT,
  });
  const bodyGlowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
    uniforms: { width: { value: 0.004 }, color: { value: new THREE.Color(0xffc86a) }, opacity: { value: 0.18 } },
    vertexShader: SHELL_VERTEX, fragmentShader: GLOW_FRAGMENT,
  });
  // 半径剖面：吻尖 → 颅鼓 → 颈收 → 胸腔 → 躯干 → 尾梢
  const PROFILE: readonly (readonly [number, number])[] = [
    [0, 0.012], [2, 0.033], [4, 0.052], [6, 0.046], [9, 0.053],
    [13, 0.062], [20, 0.060], [28, 0.050], [36, 0.032], [41, 0.014], [RINGS - 1, 0.004],
  ];
  function radiusAt(k: number) {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [k0, r0] = PROFILE[i], [k1, r1] = PROFILE[i + 1];
      if (k <= k1) return r0 + (r1 - r0) * ((k - k0) / (k1 - k0));
    }
    return PROFILE[PROFILE.length - 1][1];
  }
  const GOLD = new THREE.Color(0xf7c85a), BELLY = new THREE.Color(0xffedc2),
    BELLY_PLATE = new THREE.Color(0xf7e6be), MANE = new THREE.Color(0xe78a34),
    HORN = new THREE.Color(0xfbecc6), EYE = new THREE.Color(0x2a1c08), MOUTH = new THREE.Color(0x6b4a1e);

  /** 平滑小件：椭球 / 弯管，染顶点色后合并，与角色的 oval()/piece() 同一路数 */
  function tinted(geo: THREE.BufferGeometry, color: THREE.Color) {
    const count = geo.getAttribute("position").count;
    const rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(rgb, i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    return geo;
  }
  function ovalAt(color: THREE.Color, x: number, y: number, z: number, w: number, h: number, d: number,
                  rz = 0, ry = 0) {
    const g = new THREE.SphereGeometry(1, 12, 9).scale(w, h, d);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return tinted(g, color);
  }
  function tubeAlong(color: THREE.Color, pts: [number, number, number][], radius: number) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    return tinted(new THREE.TubeGeometry(curve, 10, radius, 6, false), color);
  }
  function mergePieces(pieces: THREE.BufferGeometry[]) {
    const merged = mergeGeometries(pieces)!;
    pieces.forEach(p => p.dispose());
    return merged;
  }

  /** 头：颅 / 颊 / 吻 / 下颌 / 颧骨 / 眉脊 / 眼 / 鹿角（带分叉）/ 颊鳍 / 须髯 / 鬃 / 嘴线 */
  function buildHeadDetails() {
    const pieces: THREE.BufferGeometry[] = [];
    pieces.push(ovalAt(GOLD, 0, 0.014, -0.010, 0.038, 0.032, 0.050));
    pieces.push(ovalAt(GOLD, 0, -0.006, 0.006, 0.032, 0.028, 0.056));
    pieces.push(ovalAt(BELLY, 0, -0.002, 0.052, 0.023, 0.020, 0.042));
    pieces.push(ovalAt(GOLD, 0, 0.011, 0.048, 0.013, 0.011, 0.024));
    pieces.push(ovalAt(BELLY, 0, -0.024, 0.050, 0.019, 0.012, 0.036));
    // 颅顶高光块（三渲二的亮面手绘块）
    pieces.push(ovalAt(new THREE.Color(0xfff6da), 0, 0.036, -0.020, 0.020, 0.006, 0.026));
    for (const side of [-1, 1]) {
      pieces.push(ovalAt(GOLD, side * 0.028, -0.004, 0.012, 0.014, 0.014, 0.022));
      pieces.push(ovalAt(GOLD, side * 0.026, 0.025, 0.016, 0.018, 0.007, 0.018, -side * 0.25));
      pieces.push(ovalAt(EYE, side * 0.028, 0.016, 0.026, 0.0075, 0.0095, 0.008));
      pieces.push(ovalAt(new THREE.Color(0xfff8e0), side * 0.030, 0.020, 0.030, 0.0026, 0.0026, 0.0026));
      // 鹿角：主枝 + 前分叉
      pieces.push(tubeAlong(HORN, [
        [side * 0.019, 0.032, -0.012], [side * 0.034, 0.066, -0.040], [side * 0.030, 0.096, -0.072],
      ], 0.0055));
      pieces.push(tubeAlong(HORN, [
        [side * 0.033, 0.062, -0.038], [side * 0.052, 0.078, -0.050], [side * 0.058, 0.094, -0.062],
      ], 0.0032));
      // 颊鳍（扇形耳鳍）
      pieces.push(ovalAt(MANE, side * 0.043, 0.010, -0.030, 0.006, 0.024, 0.030, side * 0.65, side * 0.40));
      // 须髯：从吻侧甩向后方
      pieces.push(tubeAlong(HORN, [
        [side * 0.014, -0.012, 0.058], [side * 0.038, -0.032, 0.092],
        [side * 0.062, -0.014, 0.124], [side * 0.078, 0.010, 0.138],
      ], 0.0019));
      pieces.push(ovalAt(EYE, side * 0.008, 0.006, 0.074, 0.0025, 0.0022, 0.0022));
    }
    pieces.push(tubeAlong(MOUTH, [[0, -0.016, 0.030], [0, -0.022, 0.072], [0, -0.026, 0.090]], 0.0016));
    for (let i = -2; i <= 2; i++) {
      pieces.push(ovalAt(MANE, i * 0.016, 0.030 - Math.abs(i) * 0.005, -0.058 - Math.abs(i) * 0.010,
        0.013, 0.032, 0.010, i * 0.5));
    }
    for (let i = -1; i <= 1; i++) {
      pieces.push(tubeAlong(MANE, [
        [i * 0.010, -0.030, 0.020], [i * 0.014, -0.048, -0.010], [i * 0.016, -0.054, -0.048],
      ], 0.0030));
    }
    return mergePieces(pieces);
  }
  const headDetailsGeo = buildHeadDetails();

  /** 四爪：前后两对短腿，从体侧伸出，三趾爪尖 */
  function buildLegs() {
    const pieces: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (const z0 of [0.055, -0.050]) {
        pieces.push(tubeAlong(GOLD, [
          [side * 0.020, -0.010, z0], [side * 0.082, -0.048, z0 + 0.020], [side * 0.090, -0.100, z0 + 0.042],
        ], 0.012));
        pieces.push(ovalAt(GOLD, side * 0.090, -0.102, z0 + 0.046, 0.019, 0.010, 0.023));
        pieces.push(ovalAt(MANE, side * 0.092, -0.060, z0 + 0.030, 0.010, 0.022, 0.011));
        for (const dx of [-0.013, 0, 0.013]) {
          pieces.push(tubeAlong(HORN, [
            [side * 0.090 + dx, -0.104, z0 + 0.054], [side * 0.090 + dx * 1.4, -0.108, z0 + 0.074],
          ], 0.0036));
        }
      }
    }
    return mergePieces(pieces);
  }
  const legsGeo = buildLegs();

  /** 尾鳍：三片扇形鳍 + 尾尖 */
  function buildTailFin() {
    const pieces: THREE.BufferGeometry[] = [
      ovalAt(MANE, 0, 0.002, -0.034, 0.012, 0.030, 0.055),
      ovalAt(MANE, -0.022, -0.004, -0.028, 0.008, 0.024, 0.045, 0, -0.45),
      ovalAt(MANE, 0.022, -0.004, -0.028, 0.008, 0.024, 0.045, 0, 0.45),
      tubeAlong(HORN, [[0, 0, -0.004], [0, 0.002, -0.030]], 0.006),
    ];
    return mergePieces(pieces);
  }
  const tailFinGeo = buildTailFin();

  function buildDragon(scale: number): Dragon {
    const dragonGroup = new THREE.Group();
    // 躯体环带管：预分配顶点，每帧只写位置 / 法线
    const verts = RINGS * RADIAL;
    const bodyGeo = new THREE.BufferGeometry();
    const bodyPos = new Float32Array(verts * 3);
    const bodyCol = new Float32Array(verts * 3);
    const index: number[] = [];
    for (let k = 0; k < RINGS - 1; k++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = k * RADIAL + j, b = k * RADIAL + (j + 1) % RADIAL;
        const c = (k + 1) * RADIAL + j, d = (k + 1) * RADIAL + (j + 1) % RADIAL;
        index.push(a, d, b, a, c, d);
      }
    }
    bodyGeo.setAttribute("position", new THREE.BufferAttribute(bodyPos, 3).setUsage(THREE.DynamicDrawUsage));
    bodyGeo.setAttribute("color", new THREE.BufferAttribute(bodyCol, 3));
    // 鳞纹壳要用 UV：沿体长铺 7 排、绕体 3 排
    const bodyUv = new Float32Array(verts * 2);
    for (let k = 0; k < RINGS; k++) {
      for (let j = 0; j < RADIAL; j++) {
        const i2 = (k * RADIAL + j) * 2;
        bodyUv[i2] = (k / (RINGS - 1)) * 6;
        bodyUv[i2 + 1] = (j / RADIAL) * 2;
      }
    }
    bodyGeo.setAttribute("uv", new THREE.BufferAttribute(bodyUv, 2));
    bodyGeo.setIndex(index);
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, bodyToon);
    body.castShadow = true;
    body.frustumCulled = false;
    dragonGroup.add(body);
    const bodyOutline = new THREE.Mesh(bodyGeo, bodyOutlineMat);
    bodyOutline.frustumCulled = false;
    dragonGroup.add(bodyOutline);
    // 鳞纹壳：与躯体共享同一份几何，位置每帧自动跟着走
    const scaleMesh = new THREE.Mesh(bodyGeo, scaleMat);
    scaleMesh.frustumCulled = false;
    scaleMesh.renderOrder = 2;
    dragonGroup.add(scaleMesh);
    // 金光壳：加法混合，让整条龙在呼吸里泛一层金
    const glowMesh = new THREE.Mesh(bodyGeo, bodyGlowMat);
    glowMesh.frustumCulled = false;
    glowMesh.renderOrder = 3;
    dragonGroup.add(glowMesh);
    // 背鳍飘带：脊线上方一条柔边膜，根部鬃橙、边缘浅金
    const FIN0 = 7, FIN1 = RINGS - 6, finVerts = (FIN1 - FIN0) * 2;
    const finGeo = new THREE.BufferGeometry();
    const finPos = new Float32Array(finVerts * 3);
    const finCol = new Float32Array(finVerts * 3);
    const finIndex: number[] = [];
    for (let k = 0; k < FIN1 - FIN0 - 1; k++) {
      const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
      finIndex.push(a, c, b, b, c, d);
    }
    const edgeColor = HORN.clone().lerp(new THREE.Color(0xfff2cc), 0.35);
    for (let i = 0; i < finVerts; i++) (i % 2 ? edgeColor : MANE).toArray(finCol, i * 3);
    finGeo.setAttribute("position", new THREE.BufferAttribute(finPos, 3).setUsage(THREE.DynamicDrawUsage));
    finGeo.setAttribute("color", new THREE.BufferAttribute(finCol, 3));
    finGeo.setIndex(finIndex);
    const fin = new THREE.Mesh(finGeo, dragonFinMat);
    fin.frustumCulled = false;
    dragonGroup.add(fin);
    // 头 / 四爪 / 尾鳍：各自挂到脊线对应环，朝向随切线
    const headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(headDetailsGeo, dragonToon);
    headMesh.castShadow = true;
    const headOutline = new THREE.Mesh(headDetailsGeo, detailOutlineMat);
    headGroup.add(headMesh, headOutline);
    dragonGroup.add(headGroup);
    const legsGroup = new THREE.Group();
    const legsMesh = new THREE.Mesh(legsGeo, dragonToon);
    legsMesh.castShadow = true;
    legsGroup.add(legsMesh, new THREE.Mesh(legsGeo, detailOutlineMat));
    dragonGroup.add(legsGroup);
    const tailGroup = new THREE.Group();
    tailGroup.add(new THREE.Mesh(tailFinGeo, dragonToon), new THREE.Mesh(tailFinGeo, detailOutlineMat));
    dragonGroup.add(tailGroup);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dot, color: 0xffd06a, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glowSprite.scale.setScalar(0.42 * scale);
    dragonGroup.add(glowSprite);

    const spine = Array.from({ length: RINGS }, () => new THREE.Vector3());
    const sideV = new THREE.Vector3(), upV = new THREE.Vector3(), tanV = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const headQuat = new THREE.Quaternion(), torsoQuat = new THREE.Quaternion(), tailQuat = new THREE.Quaternion();
    const headSwing = new THREE.Quaternion(), headEuler = new THREE.Euler();
    const tmpColor = new THREE.Color();
    const swim = (headAngle: number, t: number, center: THREE.Vector3, sc: number) => {
      const radius = 0.56 * sc, baseY = center.y + 0.56 * sc;
      for (let k = 0; k < RINGS; k++) {
        const angle = headAngle - k * STEP;
        // 游动中不断改形：两种波长的蜿蜒叠在一起，环半径忽紧忽松，
        // 脊线再做小幅起伏，身体没有固定不变的弧形，每一秒都是新的曲线。
        const sway = 0.046 * sc * Math.sin(t * 1.15 - k * 0.46)
          + 0.018 * sc * Math.sin(t * 2.1 - k * 0.94);
        const r = radius + sway;
        const neckLift = k < 9 ? 0.07 * sc * (1 - k / 9) ** 1.4 : 0;
        spine[k].set(
          center.x + Math.cos(angle) * r,
          baseY + neckLift
            + 0.062 * sc * Math.sin(t * 1.85 - k * 0.62) * (0.25 + k / RINGS)
            + 0.03 * sc * Math.sin(t * 0.95 + k * 0.34)
            + 0.02 * sc * Math.sin(t * 2.6 - k * 1.15),
          center.z + Math.sin(angle) * r
        );
      }
      for (let k = 0; k < RINGS; k++) {
        const prev = spine[Math.max(0, k - 1)], next = spine[Math.min(RINGS - 1, k + 1)];
        tanV.subVectors(prev, next).normalize();
        sideV.crossVectors(THREE.Object3D.DEFAULT_UP, tanV).normalize();
        upV.crossVectors(tanV, sideV).normalize();
        // 躯干一边游一边滚转，鳞片与腹甲的走向跟着流动
        const roll = 0.32 * Math.sin(t * 1.6 - k * 0.5);
        sideV.applyAxisAngle(tanV, roll);
        upV.applyAxisAngle(tanV, roll);
        basis.makeBasis(sideV, upV, tanV);
        if (k === 3) headQuat.setFromRotationMatrix(basis);
        else if (k === 15) torsoQuat.setFromRotationMatrix(basis);
        else if (k === 41) tailQuat.setFromRotationMatrix(basis);
        const r = radiusAt(k) * sc * 1.28;
        const plate = k % 4 < 2 ? BELLY_PLATE : BELLY;
        for (let j = 0; j < RADIAL; j++) {
          const theta = j / RADIAL * TAU;
          const cx = Math.cos(theta), sy = Math.sin(theta);
          const i3 = (k * RADIAL + j) * 3;
          bodyPos[i3] = spine[k].x + (sideV.x * cx + upV.x * sy * 0.88) * r;
          bodyPos[i3 + 1] = spine[k].y + (sideV.y * cx + upV.y * sy * 0.88) * r;
          bodyPos[i3 + 2] = spine[k].z + (sideV.z * cx + upV.z * sy * 0.88) * r;
          // 腹面奶白腹甲（隔环深浅）、背面金、脊线一抹鬃橙
          const belly = THREE.MathUtils.smoothstep(-sy, 0.15, 0.75);
          const dorsal = THREE.MathUtils.smoothstep(sy, 0.82, 0.98) * 0.55;
          tmpColor.copy(GOLD).lerp(plate, belly).lerp(MANE, dorsal);
          tmpColor.toArray(bodyCol, i3);
        }
        if (k >= FIN0 && k < FIN1) {
          const f = (k - FIN0) / (FIN1 - FIN0);
          // 鳍缘做成疏密相间的棘刺，远看像龙脊
          const finH = (0.010 + 0.033 * Math.sin(Math.PI * f)) * sc
            * (k % 2 ? 1.45 : 0.72) * (1 + 0.12 * Math.sin(t * 3 + k * 0.5));
          const i3 = (k - FIN0) * 6;
          finPos[i3] = spine[k].x + upV.x * r * 0.7;
          finPos[i3 + 1] = spine[k].y + upV.y * r * 0.7;
          finPos[i3 + 2] = spine[k].z + upV.z * r * 0.7;
          finPos[i3 + 3] = spine[k].x + upV.x * (r + finH) + tanV.x * 0.012 * sc * Math.sin(t * 2.6 + k);
          finPos[i3 + 4] = spine[k].y + upV.y * (r + finH) + tanV.y * 0.012 * sc * Math.sin(t * 2.6 + k);
          finPos[i3 + 5] = spine[k].z + upV.z * (r + finH) + tanV.z * 0.012 * sc * Math.sin(t * 2.6 + k);
        }
      }
      bodyGeo.attributes.position.needsUpdate = true;
      bodyGeo.attributes.color.needsUpdate = true;
      bodyGeo.computeVertexNormals();
      finGeo.attributes.position.needsUpdate = true;
      finGeo.computeVertexNormals();
      bodyOutlineMat.uniforms.width.value = 0.0085 * sc;
      // 鳞纹与金光跟着一起呼吸，金光只给一点点，别糊掉描边
      scaleMat.uniforms.width.value = 0.0032 * sc;
      scaleMat.uniforms.opacity.value = 0.58 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.2));
      bodyGlowMat.uniforms.width.value = 0.007 * sc;
      bodyGlowMat.uniforms.opacity.value = 0.26 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.05));
      bodyToon.emissiveIntensity = 0.85 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3));
      headEuler.set(0.07 * Math.sin(t * 2.1), 0.22 * Math.sin(t * 1.65), 0.1 * Math.sin(t * 1.3));
      headSwing.setFromEuler(headEuler);
      headGroup.position.copy(spine[3]);
      headGroup.quaternion.copy(headQuat).multiply(headSwing);
      headGroup.scale.setScalar(sc * 1.45);
      legsGroup.position.copy(spine[15]);
      legsGroup.quaternion.copy(torsoQuat);
      legsGroup.scale.setScalar(sc * 1.12);
      tailGroup.position.copy(spine[41]);
      tailGroup.quaternion.copy(tailQuat);
      tailGroup.scale.setScalar(sc * 1.1);
      glowSprite.position.copy(spine[2]);
    };
    return {
      group: dragonGroup, glow: glowSprite, direction: 1, offset: 0, swim,
      dispose() {
        bodyGeo.dispose(); finGeo.dispose();
        glowSprite.material.dispose();
        dragonGroup.removeFromParent();
      },
    };
  }

  function buildVisuals(emitter: Emitter) {
    const visuals = new THREE.Group();
    const { center, mutation, scale, phase } = emitter;
    const tier = wildMutationTier(mutation);
    const halos: THREE.Sprite[] = [];
    const stars: Star[] = [];
    const dragons: Dragon[] = [];
    const addHalo = (color: number, opacity: number, pos: THREE.Vector3, size: number, blending: THREE.Blending = THREE.AdditiveBlending) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dot, color, transparent: true, opacity, blending, depthWrite: false,
      }));
      sprite.position.copy(pos);
      sprite.scale.setScalar(size);
      sprite.userData.baseScale = size;
      sprite.userData.baseOpacity = opacity;
      visuals.add(sprite);
      halos.push(sprite);
    };
    if (wildMutationFamily(mutation) === "yinyang") {
      addHalo(0xf5f2ea, 0.3, center.clone().add(new THREE.Vector3(0.17 * scale, 0.36 * scale, 0)), 1.5 * scale);
      addHalo(0x14141c, 0.4, center.clone().add(new THREE.Vector3(-0.17 * scale, 0.33 * scale, 0)), 1.3 * scale, THREE.NormalBlending);
      for (let i = 0; i < tier; i++) {
        // 每颗星辰底下垫一层金色日冕，让它在草丛背景上冒出来
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dot, color: 0xffa51e, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        halo.scale.setScalar(1.2 * scale);
        visuals.add(halo);
        const starSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: star, color: 0xfbcb34, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        starSprite.scale.setScalar(0.95 * scale);
        visuals.add(starSprite);
        stars.push({ sprite: starSprite, halo });
      }
    } else {
      addHalo(0xbfe8cf, 0.26, center.clone().add(new THREE.Vector3(0, 0.42 * scale, 0)), 1.9 * scale);
      const pillar = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dot, color: 0xcdeedd, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      pillar.position.copy(center).add(new THREE.Vector3(0, 1.15 * scale, 0));
      pillar.scale.set(0.85 * scale, 2.6 * scale, 1);
      pillar.userData.baseScale = 0.85 * scale;
      pillar.userData.baseOpacity = 0.18;
      pillar.userData.pillar = true;
      visuals.add(pillar);
      halos.push(pillar);
      addHalo(0xf2d8a0, 0.2, center.clone().add(new THREE.Vector3(0, 0.12 * scale, 0)), 1.2 * scale);
      for (let i = 0; i < tier; i++) {
        const dragon = buildDragon(scale);
        dragon.direction = i % 2 === 0 ? 1 : -1;
        dragon.offset = phase + i * TAU / tier;
        visuals.add(dragon.group);
        dragons.push(dragon);
      }
    }
    emitter.visuals = visuals;
    emitter.halos = halos;
    emitter.stars = stars;
    emitter.dragons = dragons;
    group.add(visuals);
  }

  function disposeVisuals(emitter: Emitter) {
    emitter.dragons.forEach(dragon => dragon.dispose());
    emitter.visuals.traverse((obj) => {
      if (obj instanceof THREE.Sprite) obj.material.dispose();
    });
    group.remove(emitter.visuals);
  }

  return {
    group,
    setEmitter(key: string, center: THREE.Vector3 | null, mutation: WildMutation | null, scale = 1) {
      const existing = emitters.get(key);
      if (!mutation || !center) {
        if (existing) {
          disposeVisuals(existing);
          emitters.delete(key);
          dirty = true;
        }
        return;
      }
      if (existing && existing.mutation === mutation && existing.scale === scale && existing.center.distanceToSquared(center) < 1e-6) return;
      if (existing) disposeVisuals(existing);
      const emitter: Emitter = {
        key, center: center.clone(), mutation, scale, phase: hash(key) * TAU,
        visuals: new THREE.Group(), halos: [], stars: [], dragons: [],
      };
      buildVisuals(emitter);
      emitters.set(key, emitter);
      dirty = true;
    },
    update(t: number) {
      if (dirty) {
        rebuildParticles();
        dirty = false;
      }
      const pixelScale = Math.min(330, window.innerHeight * 0.43);
      glow.uniforms.t.value = t;
      glow.uniforms.pixelScale.value = pixelScale;
      dark.uniforms.t.value = t;
      dark.uniforms.pixelScale.value = pixelScale;
      for (const emitter of emitters.values()) {
        const { center, scale, phase, mutation } = emitter;
        const tier = wildMutationTier(mutation);
        const breath = 1 + 0.09 * Math.sin(t * 0.8 + phase);
        for (const halo of emitter.halos) {
          const base = halo.userData.baseScale as number;
          if (halo.userData.pillar) {
            halo.scale.set(base * breath, 2.6 * scale * (1 + 0.06 * Math.sin(t * 0.6 + phase)), 1);
          } else {
            halo.scale.setScalar(base * breath);
          }
          halo.material.opacity = (halo.userData.baseOpacity as number) * (0.85 + 0.15 * Math.sin(t * 0.9 + phase));
        }
        emitter.stars.forEach(({ sprite, halo }, i) => {
          const angle = t * 0.75 + phase + i * TAU / tier;
          const radius = (0.62 + 0.045 * Math.sin(t * 0.6 + i)) * scale;
          const x = center.x + Math.cos(angle) * radius;
          const y = center.y + (0.70 + 0.09 * Math.sin(t * 1.1 + i * 2)) * scale;
          const z = center.z + Math.sin(angle) * radius;
          sprite.position.set(x, y, z);
          // 太阳一般的闪烁：主脉动 + 一点高频抖动
          const twinkle = 0.95 * scale * (1 + tier * 0.1)
            * (1 + 0.15 * Math.sin(t * 2.6 + i * 1.7) + 0.05 * Math.sin(t * 5.1 + i));
          sprite.scale.setScalar(twinkle);
          sprite.material.rotation = t * 0.35 + i;
          sprite.material.opacity = 0.9 + 0.1 * Math.sin(t * 3.2 + i);
          halo.position.copy(sprite.position);
          halo.scale.setScalar(twinkle * 1.18);
          halo.material.opacity = 0.3 + 0.1 * Math.sin(t * 2.2 + i);
        });
        for (const dragon of emitter.dragons) {
          const speed = 0.85 + tier * 0.08;
          const headAngle = dragon.offset + dragon.direction * t * speed;
          dragon.swim(headAngle, t, center, scale);
        }
      }
    },
    dispose() {
      emitters.forEach(disposeVisuals);
      emitters.clear();
      glow.geo.dispose();
      dark.geo.dispose();
      (glow.points.material as THREE.Material).dispose();
      (dark.points.material as THREE.Material).dispose();
      headDetailsGeo.dispose();
      legsGeo.dispose();
      tailFinGeo.dispose();
      dragonToon.dispose();
      bodyRamp.dispose();
      bodyToon.dispose();
      dragonFinMat.dispose();
      scaleMat.dispose();
      bodyGlowMat.dispose();
      scaleTex.dispose();
      detailOutlineMat.dispose();
      bodyOutlineMat.dispose();
      toonRamp.dispose();
      dot.dispose();
      cloud.dispose();
      star.dispose();
      group.clear();
    },
  };
}