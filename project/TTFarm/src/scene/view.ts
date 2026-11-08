import * as THREE from "three";

export interface SceneView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize: () => void;
  dispose: () => void;
}

// 透视相机：40° 左右的视场既保留尺度感，又不像 70° 那样把地块拉变形
const FIELD_FOV = 42;
// 初始机位沿用原来的等距方向（方位 45°、俯角约 40°），换投影不换构图
export const CAMERA_HOME = new THREE.Vector3(14.9, 15.9, 14.9);
export const CAMERA_TARGET = new THREE.Vector3(0, 0.6, 0.6);

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

  // 透视相机：构图的自由度交给 OrbitControls，这里只给一个成立的初始机位
  const camera = new THREE.PerspectiveCamera(FIELD_FOV, 1, 0.1, 300);
  camera.position.copy(CAMERA_HOME);
  camera.lookAt(CAMERA_TARGET);

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
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
    resize,
    dispose,
  };
}
