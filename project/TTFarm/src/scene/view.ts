import * as THREE from "three";
import { WEATHER } from "../game/weather";
import { buildSky, type SkyWeather } from "./atmosphere";

export interface SceneView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 主光：阴影跟人走，所以 loop 每帧要把它搬到人物附近 */
  keyLight: THREE.DirectionalLight;
  updateWeather: (weather: SkyWeather) => void;
  resize: () => void;
  dispose: () => void;
}

// 透视相机：40° 左右的视场既保留尺度感，又不像 70° 那样把地块拉变形
const FIELD_FOV = 42;
// 初始机位沿用原来的等距方向（方位 45°、俯角约 40°），换投影不换构图
export const CAMERA_HOME = new THREE.Vector3(14.9, 15.9, 14.9);
export const CAMERA_TARGET = new THREE.Vector3(0, 0.6, 0.6);

export function createView(canvas: HTMLCanvasElement): SceneView {
  const compact = window.matchMedia("(pointer: coarse)").matches;
  const maxRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.75);
  let ratio = maxRatio;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !compact || window.devicePixelRatio <= 1.5, alpha: false, powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  // 软胶柔和：ACES 让明暗过渡圆润，配合软阴影与较低主光对比
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const sky = buildSky();
  scene.add(sky.sky);
  const fog = new THREE.Fog(0xdce8da, 48, 310);
  scene.fog = fog;

  // 透视相机：构图的自由度交给 OrbitControls，这里只给一个成立的初始机位
  const camera = new THREE.PerspectiveCamera(FIELD_FOV, 1, 0.1, 1400);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(CAMERA_TARGET);

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height);
  };

  // 光效关系：天空补光让暗部仍能读出结构，暖主光给出形体与投影方向，
  // 冷补光从侧后剥开轮廓，最后加一盏低强度暖轮廓光把角色头顶和长发边缘挑亮
  const hemi = new THREE.HemisphereLight(0xfff2e4, 0xa0bca3, 1.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.5);
  keyLight.position.set(9.5, 15, 7.5);
  keyLight.castShadow = true;
  const shadowSize = compact ? 1024 : 1536;
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  // 地图边长 300 米，一张 2048 贴图铺不下全场：阴影相机只罩人物周围 68×68，
  // loop 每帧把主光和人一起搬，走到哪阴影跟到哪
  keyLight.shadow.camera.left = -34;
  keyLight.shadow.camera.right = 34;
  keyLight.shadow.camera.top = 34;
  keyLight.shadow.camera.bottom = -34;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.radius = 5;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xdcebf3, 0.72);
  fillLight.position.set(-9, 6, -7);
  scene.add(fillLight);

  // 逆光轮廓：低角度、偏暖，专门用来勾出头发与肩线的高光边
  const rimLight = new THREE.DirectionalLight(0xffdfb8, 1.0);
  rimLight.position.set(-3.5, 4.2, -11);
  scene.add(rimLight);

  const clearFog = new THREE.Color(0xdce8da);
  const rainFog = new THREE.Color(0xb3c5cb);
  const mistFog = new THREE.Color(0xdde6e7);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const sun = new THREE.Color(0xffebca);
  const overcast = new THREE.Color(0xd4e3ee);
  let lastFrame = 0, lastShadow = -1000, sampleTime = 0, samples = 0;
  let skyLight = 0;
  const updateWeather = (weather: SkyWeather) => {
    const now = performance.now();
    const ms = now - lastFrame;
    lastFrame = now;
    const dt = THREE.MathUtils.clamp(ms*.001, 0, 1);
    skyLight = THREE.MathUtils.damp(skyLight, WEATHER[weather].cover, 1.6, dt);
    sky.uniforms.weather.value = skyLight;
    sky.uniforms.t.value = now * 0.001;
    const haze = sky.uniforms.haze.value = THREE.MathUtils.damp(sky.uniforms.haze.value,
      weather === "fog" ? 1 : weather === "snow" ? .41 : 0, 1.3, dt);
    const stormPhase = (now*.001) % 13;
    const flash = weather === "storm" && !reducedMotion.matches ? Math.exp(-stormPhase*3.8)*Math.min(1,stormPhase*14) : 0;
    sky.uniforms.lightning.value = flash;
    keyLight.color.lerpColors(sun, overcast, skyLight);
    keyLight.intensity = 1.95 - skyLight * 1.20 + flash*.8;
    hemi.intensity = 1.85 + skyLight * 0.18;
    rimLight.intensity = 0.84 - skyLight * 0.50;
    fog.color.lerpColors(clearFog, rainFog, skyLight).lerp(mistFog,haze);
    fog.near = THREE.MathUtils.lerp(48, 9, haze);
    fog.far = THREE.MathUtils.lerp(310 - skyLight*103, 63, haze);
    if (now - lastShadow >= (compact ? 60 : 32)) {
      renderer.shadowMap.needsUpdate = true;
      lastShadow = now;
    }
    // Measure wall-clock frame cost, including the GPU, and avoid reacting to a
    // single shader compile, tab switch or garbage collection pause.
    if (ms > 0 && ms < 200) { sampleTime += ms; samples++; }
    if (sampleTime > 2400) {
      const mean = sampleTime / samples;
      const floor = Math.min(maxRatio, compact ? 0.75 : 0.85);
      const next = THREE.MathUtils.clamp(ratio + (mean > 25 ? -0.15 : mean < 17.2 ? 0.075 : 0), floor, maxRatio);
      if (next !== ratio) {
        ratio = next;
        renderer.setPixelRatio(ratio);
      }
      sampleTime = 0;
      samples = 0;
    }
  };

  resize();
  window.addEventListener("resize", resize);

  const dispose = () => {
    window.removeEventListener("resize", resize);
    sky.dispose();
    keyLight.shadow.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    keyLight,
    updateWeather,
    resize,
    dispose,
  };
}
