import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AvatarRig } from "./rig";
import { alignAvatar, createCapturedPose, motionBones } from "./capturedMotion";
import { createStrawHat } from "./strawHat";
import type { AvatarId, OutfitId } from "../game/appearance";
import { COUTURE } from "../game/couture";

/** 内置低面数小穗。VRM 下载或解码期间可直接操作，离线时也保留完整形象。 */
export function createFieldAvatar(avatar: AvatarId = "xiaosui", outfit: OutfitId = "field", bottom: OutfitId = outfit): AvatarRig {
  const visual = new THREE.Group();
  const body = new THREE.Group();
  visual.add(body);
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.55 });
  const geometries: THREE.BufferGeometry[] = [];
  const male = avatar === "qinghe", rain = outfit === "raincoat", ranger = outfit === "ranger";
  const dress = !male && COUTURE.find(item => item.id === outfit);
  const cream = dress ? new THREE.Color(dress.swatch).getHex() : rain ? 0xe3a644 : ranger ? 0x586e56 : 0xfff1d6;
  const skin = male ? 0xe8bf9c : 0xf7caaf, chestnut = male ? 0x334441 : 0x856652;
  const navy = dress ? new THREE.Color(dress.swatch).multiplyScalar(.62).getHex() : bottom === "ranger" ? 0x998064 : 0x374f59;
  let pieces: THREE.BufferGeometry[] = [];
  function piece(g: THREE.BufferGeometry, hex: number, x: number, y: number, z: number) {
    g.translate(x, y, z);
    const color = new THREE.Color(hex);
    const colors = new Float32Array(3 * g.getAttribute("position").count);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pieces.push(g);
  }
  function oval(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    piece(new THREE.SphereGeometry(1, 12, 9).scale(w, h, d), color, x, y, z);
  }
  function cloth(y: number, bottom: number, top: number, height: number, hex: number, sides = 16) {
    piece(new THREE.CylinderGeometry(top, bottom, height, sides).scale(1, 1, 0.78), hex, 0, y, 0);
  }
  function finish(parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const merged = mergeGeometries(pieces)!;
    pieces.forEach(g => g.dispose());
    pieces = [];
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  cloth(0.92, rain ? .20 : 0.151, male ? .202 : 0.177, 0.29, cream);
  if(dress){
    cloth(.708,.25,.14,.275,cream,24);
    cloth(.575,.249,.241,.014,0xf7e1cb,24);
    cloth(.843,.151,.149,.033,navy,24);
  } else cloth(0.727, male || ranger ? .155 : 0.199, 0.143, 0.22, rain ? cream : navy, 14);
  if (ranger) oval(0,.911,-.144,.125,.147,.072,0x9d794f);
  cloth(1.079, 0.171, 0.073, 0.082, navy);
  oval(0, 1.13, 0, 0.065, 0.072, 0.065, skin);
  if(dress) oval(0,1.043,.122,.025,.031,.015,0xf3e9c8);
  else {
    oval(0, 1.038, 0.118, 0.032, 0.040, 0.032, 0xe58a49);
    oval(0, 0.988, 0.125, 0.029, 0.048, 0.017, 0xdb7542);
  }
  const torso = finish(body);

  oval(0, 0.19, 0.012, 0.211, 0.248, 0.185, skin);
  oval(0, 0.219, -0.038, 0.219, 0.246, 0.175, chestnut);
  for (const sign of [-1, 1]) {
    oval(sign * 0.184, 0.144, 0.049, 0.046, 0.13, 0.066, chestnut);
    if (!male) {
      oval(sign * 0.194, 0.052, -0.105, 0.064, 0.19, 0.069, chestnut);
      oval(sign * 0.193, 0.171, -0.096, 0.067, 0.027, 0.066, 0xe2914e);
    }
    oval(sign * 0.077, 0.19, 0.182, 0.022, 0.033, 0.009, 0x4b342e);
    oval(sign * 0.074, 0.202, 0.19, 0.006, 0.008, 0.003, 0xfff7de);
    oval(sign * 0.116, 0.141, 0.169, 0.026, 0.010, 0.004, 0xe8a496);
  }
  for (let i = -2; i <= 2; i++) {
    oval(i * 0.062, 0.323 - Math.abs(i) * 0.012, 0.130 - Math.abs(i) * 0.015,
      0.057, 0.070 + (i % 2) * 0.018, 0.051, chestnut);
  }
  oval(0, 0.115, 0.185, 0.019, 0.004, 0.003, 0xad7669);
  const head = finish(body, 0, 1.13);
  const hat = createStrawHat();
  hat.position.set(0, 0.354, -0.018);
  hat.scale.setScalar(1.53);
  hat.rotation.set(-0.12, -0.1, 0.075);
  head.add(hat);
  hat.visible = !male && outfit === "field";

  const limbs = [1, -1].map(sign => {
    oval(0, -0.12, 0, 0.067, 0.154, 0.074, !dress && (male || bottom !== "field") ? navy : skin);
    const thigh = finish(body, sign * 0.084, 0.714);
    oval(0, -0.126, 0, 0.051, 0.161, 0.057, dress ? skin : male || bottom !== "field" ? navy : cream);
    const shin = finish(thigh, 0, -0.284);
    oval(0, -0.020, 0.031, 0.061, 0.063, 0.1, dress ? navy : 0x705747);
    const shoe = finish(shin, 0, -0.231);
    oval(0, -0.105, 0, 0.066, 0.13, 0.068, cream);
    const shoulder = finish(body, sign * 0.17, 1.044);
    oval(0, -0.079, 0, 0.041, 0.099, 0.043, skin);
    oval(0, -0.172, 0.009, 0.046, 0.06, 0.04, skin);
    const elbow = finish(shoulder, 0, -0.19);
    return { sign, thigh, shin, shoe, shoulder, elbow };
  });
  // Pivot the torso at its pelvis, and preserve the seams where the mesh parts meet.
  const waist = 0.714;
  body.children.forEach(child => { child.position.y -= waist; });
  body.position.y = waist - 0.116;
  const chest = new THREE.Group();
  chest.position.y = 0.18;
  body.add(chest);
  chest.attach(torso);
  chest.attach(head);
  const pose = createCapturedPose();
  const joint = (name: string) => pose.bones[motionBones.indexOf(name)];
  const spine = joint("spine"), chestBone = joint("chest"), neck = joint("neck"), headBone = joint("head");
  const hips = joint("hips");
  const armsAndLegs = limbs.map(l => {
    const side = l.sign === 1 ? "left" : "right";
    chest.attach(l.shoulder);
    const basis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), l.sign * Math.PI / 2);
    return { ...l, basis, inverseBasis: basis.clone().invert(),
      collar: joint(side+"Shoulder"), arm: joint(side+"UpperArm"), forearm: joint(side+"LowerArm"),
      femur: joint(side+"UpperLeg"), tibia: joint(side+"LowerLeg"), foot: joint(side+"Foot") };
  });
  const soles = limbs.flatMap(l => [
    { bone: l.shoe, local: new THREE.Vector3(0, -0.080, -0.032) },
    { bone: l.shoe, local: new THREE.Vector3(0, -0.072, 0.091) },
  ]);
  const align = alignAvatar(visual, soles, head, body);
  return {
    visual,
    animate: (_dt, _t, m) => {
      pose.sample(m);
      body.quaternion.copy(hips);
      chest.quaternion.copy(spine).multiply(chestBone);
      head.quaternion.copy(neck).multiply(headBone);
      for (const l of armsAndLegs) {
        l.thigh.quaternion.copy(l.femur);
        l.shin.quaternion.copy(l.tibia);
        l.shoe.quaternion.copy(l.foot);
        l.shoulder.quaternion.copy(l.collar).multiply(l.arm).multiply(l.basis);
        l.elbow.quaternion.copy(l.inverseBasis).multiply(l.forearm).multiply(l.basis);
      }
      visual.position.x = pose.shift;
      align(pose.flight, pose.headAboveWater, m);
    },
    dispose: () => {
      geometries.forEach(g => g.dispose());
      material.dispose();
      hat.geometry.dispose();
      (hat.material as THREE.Material).dispose();
    },
  };
}
