import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { AvatarRig } from "./rig";

/** 角色统一高度：VRM 导进来后按包围盒缩放到这个身高（米） */
const TARGET_HEIGHT = 1.66;

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

export interface VrmRig extends AvatarRig {
  vrm: VRM;
}

/** 取骨架节点，缺骨骼时给一个空 Object3D，保证 Player 的赋值不会崩 */
function bone(vrm: VRM, name: string): THREE.Object3D {
  const node =
    vrm.humanoid?.getNormalizedBoneNode(name as never) ??
    vrm.humanoid?.getRawBoneNode(name as never);
  return (node as THREE.Object3D | null) ?? new THREE.Object3D();
}

export async function loadVrmRig(url: string): Promise<VrmRig> {
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error("文件不是有效的 VRM 模型");

  // 官方推荐的清理与骨架合并：少一批 draw call，动画更省
  try {
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
  } catch (err) {
    console.warn("[vrm] 预处理跳过", err);
  }
  // VRM 0.x 面向 -Z，统一转成 +Z，和农场里的朝向约定一致
  VRMUtils.rotateVRM0(vrm);

  // —— 按包围盒统一身高，并把脚底贴到 y=0 ——
  vrm.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = TARGET_HEIGHT / (size.y || TARGET_HEIGHT);
  vrm.scene.scale.setScalar(scale);
  vrm.scene.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(vrm.scene);
  vrm.scene.position.y -= box2.min.y;

  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // VRM 的头发/裙摆常有薄片，关掉视锥剔除免得转身时闪没
    mesh.frustumCulled = false;
  });

  // 外套一层 group 承载整体倾斜，避免直接改 vrm.scene 的旋转与 VRM0 修正打架
  const body = new THREE.Group();
  body.add(vrm.scene);

  const visual = new THREE.Group();
  visual.add(body);

  const head = bone(vrm, "head");
  const leftLeg = bone(vrm, "leftUpperLeg");
  const rightLeg = bone(vrm, "rightUpperLeg");
  const leftKnee = bone(vrm, "leftLowerLeg");
  const rightKnee = bone(vrm, "rightLowerLeg");
  const leftArm = bone(vrm, "leftUpperArm");
  const rightArm = bone(vrm, "rightUpperArm");
  const leftElbow = bone(vrm, "leftLowerArm");
  const rightElbow = bone(vrm, "rightLowerArm");
  const chest = bone(vrm, "chest");
  const hips = bone(vrm, "hips");

  // VRM 的骨架绑定姿态是 T-pose，必须先记下原始朝向，再改成自然下垂的 A-pose
  const rest = {
    leftArm: leftArm.quaternion.clone(),
    rightArm: rightArm.quaternion.clone(),
    leftLeg: leftLeg.quaternion.clone(),
    rightLeg: rightLeg.quaternion.clone(),
    leftKnee: leftKnee.quaternion.clone(),
    rightKnee: rightKnee.quaternion.clone(),
    leftElbow: leftElbow.quaternion.clone(),
    rightElbow: rightElbow.quaternion.clone(),
    chest: chest.quaternion.clone(),
    hips: hips.quaternion.clone(),
  };
  const ARM_DOWN = 1.22;
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  const qx = new THREE.Quaternion();
  const qy = new THREE.Quaternion();
  const qz = new THREE.Quaternion();

  // —— 眨眼：只改 blink 表情，不做口型 ——
  let blinkClock = 0;
  let blinkNext = 2.6 + Math.random() * 2.2;

  const animate = (dt: number, _t: number, moving: boolean, phase: number) => {
    // 走路时是一个真正的迈步循环：大腿前后摆、小腿屈膝、手臂反向摆、胸口轻微扭转；
    // 站着时只有极小的呼吸摆幅，避免"僵尸直腿"。
    // 姿态用四元数在父空间里叠加：先按 Z 轴把 T-pose 的手臂放下，再按 X 轴做前后摆，
    // 直接用 Euler 的 x/z 会互相耦合，手臂就会横着飞出去。
    const amp = moving ? 1 : 0.06;
    const s = Math.sin(phase);

    // 大腿：前后摆，左腿与右腿反相（正角度 = 脚往身后走）
    qx.setFromAxisAngle(AXIS_X, s * 0.62 * amp);
    leftLeg.quaternion.copy(rest.leftLeg).premultiply(qx);
    qx.setFromAxisAngle(AXIS_X, -s * 0.62 * amp);
    rightLeg.quaternion.copy(rest.rightLeg).premultiply(qx);

    // 小腿：在腿往后摆的半个周期里屈膝（正角度 = 脚后收，符合膝盖只能往后弯）
    qx.setFromAxisAngle(AXIS_X, Math.max(0, Math.sin(phase + Math.PI / 2)) * 0.9 * amp);
    leftKnee.quaternion.copy(rest.leftKnee).premultiply(qx);
    qx.setFromAxisAngle(AXIS_X, Math.max(0, Math.sin(phase - Math.PI / 2)) * 0.9 * amp);
    rightKnee.quaternion.copy(rest.rightKnee).premultiply(qx);

    // 手臂：与对侧腿同相摆动（左腿向后时左臂向前）
    const armSwing = s * 0.55 * amp;
    qz.setFromAxisAngle(AXIS_Z, -ARM_DOWN);
    qx.setFromAxisAngle(AXIS_X, -armSwing);
    leftArm.quaternion.copy(rest.leftArm).premultiply(qz).premultiply(qx);
    qz.setFromAxisAngle(AXIS_Z, ARM_DOWN);
    qx.setFromAxisAngle(AXIS_X, armSwing);
    rightArm.quaternion.copy(rest.rightArm).premultiply(qz).premultiply(qx);

    // 手肘保持一点自然前弯（负角度 = 小臂往前收）
    qx.setFromAxisAngle(AXIS_X, -0.14 - Math.max(0, armSwing) * 0.4);
    leftElbow.quaternion.copy(rest.leftElbow).premultiply(qx);
    qx.setFromAxisAngle(AXIS_X, -0.14 - Math.max(0, -armSwing) * 0.4);
    rightElbow.quaternion.copy(rest.rightElbow).premultiply(qx);

    // 躯干：胸口与胯部反向轻微扭转，走路才不像一块板
    qy.setFromAxisAngle(AXIS_Y, s * 0.1 * amp);
    chest.quaternion.copy(rest.chest).premultiply(qy);
    qy.setFromAxisAngle(AXIS_Y, -s * 0.06 * amp);
    hips.quaternion.copy(rest.hips).premultiply(qy);

    blinkClock += dt;
    if (blinkClock >= blinkNext) {
      blinkClock = 0;
      blinkNext = 2.6 + Math.random() * 2.2;
    }
    const manager = vrm.expressionManager;
    if (manager) {
      // 0.18s 内快速闭合再张开
      const phaseBlink = blinkClock;
      const value = phaseBlink < 0.18 ? Math.sin((phaseBlink / 0.18) * Math.PI) : 0;
      manager.setValue("blink", value);
    }
    // 发丝物理、表情混合都在这里推进
    vrm.update(dt);
  };

  const dispose = () => {
    try {
      VRMUtils.deepDispose(vrm.scene);
    } catch (err) {
      console.warn("[vrm] dispose 失败", err);
    }
  };

  return {
    vrm,
    visual,
    body,
    head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    animate,
    selfAnimated: true,
    dispose,
  };
}
