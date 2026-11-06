import * as THREE from "three";

export interface SceneView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  setViewHeight: (height: number) => void;
  getViewHeight: () => number;
  resize: () => void;
  dispose: () => void;
}

const BASE_VIEW_HEIGHT = 15;
const MIN_VIEW_HEIGHT = 9;
const MAX_VIEW_HEIGHT = 21;

export function createView(canvas: HTMLCanvasElement): SceneView {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();

  // 正交等距相机：35° 俯角 + 45° 方位，项目只做缩放，不做自由环绕
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(16, 17, 16);
  camera.lookAt(0, 0.5, 0.4);

  let viewHeight = BASE_VIEW_HEIGHT;

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const halfH = viewHeight / 2;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
  };

  const setViewHeight = (height: number) => {
    viewHeight = Math.min(MAX_VIEW_HEIGHT, Math.max(MIN_VIEW_HEIGHT, height));
    resize();
  };

  // 三个光源角色：天空补光决定暗部可读性，主光决定形体与投影，冷补光把轮廓从背景剥开
  const hemi = new THREE.HemisphereLight(0xdcf1ff, 0x8a805c, 1.15);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff2d2, 2.3);
  keyLight.position.set(7.5, 13, 5.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -11;
  keyLight.shadow.camera.right = 11;
  keyLight.shadow.camera.top = 11;
  keyLight.shadow.camera.bottom = -11;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.radius = 2;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xc9deff, 0.85);
  fillLight.position.set(-9, 6, -7);
  scene.add(fillLight);

  resize();
  window.addEventListener("resize", resize);

  const dispose = () => {
    window.removeEventListener("resize", resize);
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    setViewHeight,
    getViewHeight: () => viewHeight,
    resize,
    dispose,
  };
}
