import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface SceneView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** 主光：阴影跟人走，所以 loop 每帧要把它搬到人物附近 */
  keyLight: THREE.DirectionalLight;
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
  // three r187 起 PCFSoftShadowMap 已被移除，柔化交给 light.shadow.radius
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // 卡通场景要的是干净饱和的色块，ACES 会把中间调和饱和度压灰，改用 Neutral
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();

  // 天空：一段由浅蓝到近白的竖向渐变，比单色背景更像晴天
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext("2d")!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, "#8fd0f5");
  skyGrad.addColorStop(0.55, "#c9e9fb");
  skyGrad.addColorStop(1, "#f2fbff");
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  // 雾：方形地图边长 300 米，雾线必须推到山外，否则走到地图边上远山就糊成白墙
  // 雾只吃远景：草原一滴雾都不要，草地一发白整张图就塌了
  scene.fog = new THREE.Fog(0xdaf1fb, 210, 620);

  // 程序化环境光（RoomEnvironment）：不下载任何 HDR 文件，给材质一层柔和反射，
  // 卡通材质上只取一点点，避免画面被反射洗白
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envMap = pmrem.fromScene(roomEnv, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.5;
  roomEnv.dispose();
  pmrem.dispose();

  // 透视相机：构图的自由度交给 OrbitControls，这里只给一个成立的初始机位
  const camera = new THREE.PerspectiveCamera(FIELD_FOV, 1, 0.1, 1400);
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

  // 光效关系：天空补光让暗部仍能读出结构，暖主光给出形体与投影方向，
  // 冷补光从侧后剥开轮廓，最后加一盏低强度暖轮廓光把角色头顶和长发边缘挑亮
  const hemi = new THREE.HemisphereLight(0xdff2ff, 0x9ad06b, 1.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.5);
  keyLight.position.set(9.5, 15, 7.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  // 地图边长 300 米，一张 2048 贴图铺不下全场：阴影相机只罩人物周围 68×68，
  // loop 每帧把主光和人一起搬，走到哪阴影跟到哪
  keyLight.shadow.camera.left = -34;
  keyLight.shadow.camera.right = 34;
  keyLight.shadow.camera.top = 34;
  keyLight.shadow.camera.bottom = -34;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.radius = 3;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xcfe6ff, 0.85);
  fillLight.position.set(-9, 6, -7);
  scene.add(fillLight);

  // 逆光轮廓：低角度、偏暖，专门用来勾出头发与肩线的高光边
  const rimLight = new THREE.DirectionalLight(0xffdfb8, 1.0);
  rimLight.position.set(-3.5, 4.2, -11);
  scene.add(rimLight);

  // 地面反光：极弱的一层暖色，避免裙摆与鞋底死黑
  const bounceLight = new THREE.HemisphereLight(0xffe7bd, 0x6c7c4c, 0.3);
  scene.add(bounceLight);


  resize();
  window.addEventListener("resize", resize);

  const dispose = () => {
    window.removeEventListener("resize", resize);
    envMap.dispose();
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    keyLight,
    resize,
    dispose,
  };
}
