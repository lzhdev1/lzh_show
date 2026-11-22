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
    } else {
      // 霜 / 珠：从冠层慢慢飘落、化开
      float r = 0.16 + 0.3 * aSeed;
      p += vec3(cos(ang) * r, 0.95 - life * 0.85, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.42;
    }
    vColor = aColor;
    vec4 eye = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * eye;
    float swell = aMode < 1.5 ? 0.7 + 0.6 * life : 1.0;
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
}

/** 全部菜地共用一次绘制；阶段 / 变异变化时重建该地块的柔光配方。 */
export function createCropAuras(centers: THREE.Vector3[]) {
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
      const center = centers[id];
      if (!center) continue;
      const [rise, orbit, dust, fall, speed] = recipeOf(aura.mutation);
      const fruit = new THREE.Color(MUTATIONS[aura.mutation].fruit);
      const puff = fruit.clone().lerp(white, 0.45);
      const cloudTint = fruit.clone().lerp(white, 0.7);
      const mote = fruit.clone().lerp(white, 0.25);
      const flake = fruit.clone().lerp(white, 0.6);
      const s = 0.55 + 0.45 * Math.min(1, 0.18 + aura.stage * 0.28);
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
      aura.halos = [];
    }
    for (const [id, aura] of plots) {
      const center = centers[id];
      if (!center) continue;
      const fruit = new THREE.Color(MUTATIONS[aura.mutation].fruit);
      const s = 0.55 + 0.45 * Math.min(1, 0.18 + aura.stage * 0.28);
      const add = (color: THREE.Color, opacity: number, size: number, y: number) => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dot, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
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
      }
    },
    setPlot(id: number, mutation: Mutation | null, stage: number) {
      const existing = plots.get(id);
      // 野菜变异走 wildAuras 的黑白雾 / 玉云，这里不叠加
      if (!mutation || stage < 0 || isWildMutation(mutation)) {
        if (existing) {
          existing.halos.forEach(h => { h.material.dispose(); h.removeFromParent(); });
          plots.delete(id);
          rebuild();
        }
        return;
      }
      if (existing && existing.mutation === mutation && existing.stage === stage) return;
      if (existing) existing.halos.forEach(h => { h.material.dispose(); h.removeFromParent(); });
      plots.set(id, { mutation, stage, halos: [] });
      rebuild();
      rebuildHalos();
    },
    dispose() {
      for (const aura of plots.values()) aura.halos.forEach(h => h.material.dispose());
      plots.clear();
      geo.dispose();
      mat.dispose();
      dot.dispose();
      cloud.dispose();
      group.clear();
    },
  };
}