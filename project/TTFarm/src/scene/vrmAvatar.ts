import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import type { AvatarMotion, AvatarRig } from "./rig";
import { alignAvatar, createCapturedPose, motionBones, type SolePoint } from "./capturedMotion";
import { createStrawHat } from "./strawHat";
import { dressFarmer } from "./farmerWardrobe";
import type { AvatarId, OutfitId } from "../game/appearance";
import { isCouture } from "../game/couture";

const TARGET_HEIGHT = 1.66;
const loader = new GLTFLoader();
loader.register(parser => new VRMLoaderPlugin(parser));

export async function loadVrmRig(url: string, builtin: boolean, avatar: AvatarId = "xiaosui",
                                 outfit: OutfitId = "field", bottom: OutfitId = outfit): Promise<AvatarRig> {
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) {
    VRMUtils.deepDispose(gltf.scene);
    throw new Error("文件不是有效的 VRM 模型");
  }
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineMorphs(vrm);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);

  vrm.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(vrm.scene);
  const scale = TARGET_HEIGHT / (bounds.max.y - bounds.min.y || TARGET_HEIGHT);
  const visual = new THREE.Group();
  visual.add(vrm.scene);
  visual.scale.setScalar(scale);
  vrm.scene.position.y -= bounds.min.y;
  visual.updateMatrixWorld(true);
  vrm.scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = !(obj.material?.isOutline);
      obj.receiveShadow = false;
      obj.frustumCulled = false;
    }
  });

  let hat: THREE.Mesh | undefined;
  if (builtin) {
    const head = vrm.humanoid.getRawBoneNode("head");
    if (head) {
      hat = createStrawHat();
      head.getWorldPosition(hat.position);
      hat.position.y = TARGET_HEIGHT - 0.064;
      hat.position.z -= 0.018;
      hat.rotation.set(-0.08, -0.12, 0.09);
      // 先在世界空间定尺寸和倾角，再挂到原始骨骼，避免作者绑定姿态的局部轴偏转。
      head.attach(hat);
    }
  }

  // The skeleton carries the long hair with the head. Removing the loose
  // hair chains also avoids a burst of inertia after a turn or a dropped frame.
  if (builtin && vrm.springBoneManager) {
    for (const spring of vrm.springBoneManager.joints) {
      if (/^J_Sec_(Hair|[LR]_TopsUpperArm)/.test(spring.bone.name)) {
        vrm.springBoneManager.deleteJoint(spring);
      }
    }
  }
  const humanoid = vrm.humanoid;
  const pose = createCapturedPose();
  const nodes = motionBones.map(name => humanoid.getNormalizedBoneNode(name as VRMHumanBoneName));
  const legacy = vrm.meta.metaVersion === "0";
  const leftArm = humanoid.getNormalizedBoneNode("leftUpperArm");
  const rightArm = humanoid.getNormalizedBoneNode("rightUpperArm");
  const roll = new THREE.Quaternion(), forward = new THREE.Vector3(0, 0, 1);
  let dressArmAngle = 0;
  const fingers: { node: THREE.Object3D; curl: number }[] = [];
  for (const side of ["left", "right"] as const) {
    const sign = (side === "left" ? -1 : 1) * (legacy ? -1 : 1);
    for (const [i, digit] of ["Index","Middle","Ring","Little"].entries()) {
      for (const [j, joint] of ["Proximal","Intermediate","Distal"].entries()) {
        const node = humanoid.getNormalizedBoneNode(`${side}${digit}${joint}` as VRMHumanBoneName);
        if (node) fingers.push({ node, curl: sign * (1 + i * 0.12) * [0.20,0.40,0.21][j] });
      }
    }
  }
  const soles: SolePoint[] = [];
  for (const side of ["left", "right"] as const) {
    const foot = humanoid.getRawBoneNode(`${side}Foot`);
    if (!foot) continue;
    const toes = humanoid.getRawBoneNode(`${side}Toes`) ?? foot;
    const heelPoint = foot.getWorldPosition(new THREE.Vector3());
    heelPoint.set(heelPoint.x, 0, heelPoint.z - 0.042);
    const toePoint = toes.getWorldPosition(new THREE.Vector3());
    toePoint.set(toePoint.x, 0, toePoint.z + (toes === foot ? 0.14 : 0.036));
    soles.push({ bone: foot, local: foot.worldToLocal(heelPoint) },
      { bone: toes, local: toes.worldToLocal(toePoint) });
  }
  const align = alignAvatar(visual, soles, humanoid.getRawBoneNode("head")!, humanoid.getRawBoneNode("hips")!);
  let blinkClock = 0, nextBlink = 3;
  const animate = (dt: number, _time: number, m: AvatarMotion) => {
    pose.sample(m);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      const q = node.quaternion.copy(pose.bones[i]);
      if (legacy) { q.x = -q.x; q.z = -q.z; }
    }
    if (dressArmAngle && !m.saddleHeight) {
      const idle = (1 - m.moving) * (1 - m.jumpWeight) * (1 - m.swimming) * (1 - (m.actionWeight ?? 0));
      const angle = dressArmAngle * idle;
      leftArm?.quaternion.premultiply(roll.setFromAxisAngle(forward, angle));
      rightArm?.quaternion.premultiply(roll.setFromAxisAngle(forward, -angle));
    }
    const fist = m.action === "punch" ? 1 + 1.6 * (m.actionWeight ?? 0) : 1;
    const grip = (1 + 1.1 * m.running * (1 - m.jumpWeight)) * (1 - 0.8 * m.swimming) * fist;
    for (const finger of fingers) finger.node.rotation.z = finger.curl * grip;
    visual.position.x = pose.shift;
    blinkClock += dt;
    if (blinkClock > nextBlink) {
      blinkClock = 0;
      nextBlink = 2.8 + Math.random() * 2;
    }
    vrm.expressionManager?.setValue("blink", blinkClock < 0.15 ? Math.sin(blinkClock / 0.15 * Math.PI) : 0);
    vrm.update(dt);
    align(pose.flight, pose.headAboveWater, m);
  };
  let undress: (() => void) | undefined;
  const setAppearance = (id: AvatarId, clothes: OutfitId, trousers: OutfitId = clothes) => {
    undress?.();
    undress = dressFarmer(vrm, id, clothes, trousers);
    dressArmAngle = 0;
    if (id === "xiaosui" && isCouture(clothes)) {
      // Sample the dress once at palm height, so a slim sheath needs less
      // shoulder abduction than a wide tutu. All garments share VRM bind space.
      let width = 0;
      vrm.scene.traverse(mesh => {
        if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.name.startsWith("couture-") || mesh.name==="couture-halo") return;
        const p = mesh.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          if (p.getY(i) >= .73 && p.getY(i) <= .86 && Math.abs(p.getZ(i) - .05) < .085)
            width = Math.max(width, Math.abs(p.getX(i)));
        }
      });
      // Resting fingertips sit 16 cm off centre, 52 cm below the shoulder.
      dressArmAngle = THREE.MathUtils.clamp((width + .018 - .16) / .52, 0, .41);
    }
    visual.scale.setScalar(scale * (id === "qinghe" ? 1.065 : 1));
    if (hat) hat.visible = id === "xiaosui" && clothes === "field";
  };
  if (builtin) setAppearance(avatar, outfit, bottom);
  return { visual, animate, setAppearance: builtin ? setAppearance : undefined,
    dispose: () => { undress?.(); VRMUtils.deepDispose(vrm.scene); } };
}
