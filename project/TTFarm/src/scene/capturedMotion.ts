import * as THREE from "three";
import data from "./locomotion.json";
import type { AvatarMotion } from "./rig";
import { createSwimStroke } from "./swimMotion";

export const motionBones = data.bones;
type PackedClip = typeof data.walk;

function unpack(clip: PackedClip) {
  const bytes = Uint8Array.from(atob(clip.rotations), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const values = new Float32Array(bytes.length / 2);
  for (let i = 0; i < values.length; i++) values[i] = view.getInt16(i * 2, true) / 32767;
  return { values, count: clip.count, shift: clip.shift, flight: clip.flight };
}
const walk = unpack(data.walk), run = unpack(data.run), jump = unpack(data.jump), idle = unpack(data.idle);
const { lerp } = THREE.MathUtils;
const sampleSwim = createSwimStroke(motionBones);
const hips = motionBones.indexOf("hips"), spine = motionBones.indexOf("spine");
const chest = motionBones.indexOf("chest"), neck = motionBones.indexOf("neck"), head = motionBones.indexOf("head");
const leftArm = motionBones.indexOf("leftUpperArm"), rightArm = motionBones.indexOf("rightUpperArm");
const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);

function hipLineAngle(q: THREE.Quaternion) {
  return Math.atan2(2 * (q.x * q.z - q.w * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
}

function standingPose() {
  const bones = motionBones.map((_, i) => new THREE.Quaternion().fromArray(idle.values, i * 4));
  function rest(name: string, pitch: number, yaw = 0, roll = 0) {
    bones[motionBones.indexOf(name)].setFromEuler(new THREE.Euler(pitch, yaw, roll));
  }
  // The jump take ends with the actor's pelvis ahead of the ankles. Retain
  // their relaxed arms but balance the standing spine over the planted feet.
  rest("hips", 0.015);
  rest("spine", 0.035);
  rest("chest", 0.025);
  rest("neck", -0.035);
  rest("head", -0.035);
  for (const [side, sign] of [["left", 1], ["right", -1]] as const) {
    rest(side + "UpperLeg", -0.065, 0, 0.047 * sign);
    rest(side + "LowerLeg", 0.10);
    rest(side + "Foot", -0.05, 0.065 * sign, -0.047 * sign);
    rest(side + "Toes", 0);
  }
  return bones;
}

class ClipCursor {
  private a = 0;
  private b = 0;
  private weight = 0;
  private next = new THREE.Quaternion();
  constructor(private clip: ReturnType<typeof unpack>) {}

  seek(phase: number) {
    const frame = phase * (this.clip.count - 1);
    this.a = Math.floor(frame);
    this.b = Math.min(this.a + 1, this.clip.count - 1);
    this.weight = frame - this.a;
  }
  sample(bone: number, out: THREE.Quaternion) {
    const values = this.clip.values;
    out.fromArray(values, (this.a * motionBones.length + bone) * 4);
    this.next.fromArray(values, (this.b * motionBones.length + bone) * 4);
    return out.slerp(this.next, this.weight);
  }
  curve(values: number[]) { return lerp(values[this.a], values[this.b], this.weight) / 1000; }
}

function ridingPose() {
  const bones = standingPose();
  const rotation = new THREE.Euler();
  const set = (name: string, x: number, y = 0, z = 0) =>
    bones[motionBones.indexOf(name)].setFromEuler(rotation.set(x, y, z));
  set("spine", 0.09);
  set("neck", -0.07);
  for (const [side, sign] of [["left", 1], ["right", -1]] as const) {
    set(side + "UpperLeg", -1.02, -0.18 * sign, 0.58 * sign);
    set(side + "LowerLeg", 1.17);
    set(side + "Foot", -0.18, 0.08 * sign, -0.31 * sign);
    // Hands meet in front of the rider, elbows below the shoulders.
    const rest = new THREE.Vector3(sign, 0, 0);
    const upper = bones[motionBones.indexOf(side + "UpperArm")];
    upper.setFromUnitVectors(rest, new THREE.Vector3(0.16 * sign, -0.88, 0.44).normalize());
    bones[motionBones.indexOf(side + "LowerArm")].setFromUnitVectors(rest,
      new THREE.Vector3(-0.28 * sign, -0.12, 0.95).normalize().applyQuaternion(upper.clone().invert()));
  }
  return bones;
}

/** Shared actor motion for the VRM and the loading avatar; no per-frame allocations. */
export function createCapturedPose() {
  const walkCursor = new ClipCursor(walk), runCursor = new ClipCursor(run), jumpCursor = new ClipCursor(jump);
  const rotation = new THREE.Quaternion();
  const still = standingPose();
  const seated = ridingPose();
  const bones = motionBones.map(() => new THREE.Quaternion());
  const pose = {
    bones, shift: 0, flight: 0, headAboveWater: 0,
    sample(m: AvatarMotion) {
      if (m.saddleHeight) {
        for (let i = 0; i < bones.length; i++) bones[i].copy(seated[i]);
        bones[spine].multiply(rotation.setFromAxisAngle(axisX, Math.sin(m.phase * Math.PI * 4) * 0.045 * m.moving));
        bones[chest].multiply(rotation.setFromAxisAngle(axisZ, -(m.turn ?? 0) * 0.09));
        pose.shift = pose.flight = pose.headAboveWater = 0;
        return;
      }
      if (m.swimming === 1) {
        pose.shift = pose.flight = 0;
        pose.headAboveWater = sampleSwim(bones, m.swimPhase, m.moving, 1);
        return;
      }
      walkCursor.seek(m.phase); runCursor.seek(m.phase); jumpCursor.seek(m.jumpPhase);
      for (let i = 0; i < bones.length; i++) {
        const q = walkCursor.sample(i, bones[i]);
        if (m.running > 0.001) q.slerp(runCursor.sample(i, rotation), m.running);
        if (m.moving < 0.999) q.slerp(still[i], 1 - m.moving);
        if (m.jumpWeight > 0) q.slerp(jumpCursor.sample(i, rotation), m.jumpWeight);
      }
      const ground = m.moving * (1 - m.jumpWeight) * (1 - m.swimming);
      const steering = (m.turn ?? 0) * ground;
      // The source actor's rest spine differs from the upright VRM. Place
      // the shoulders over the stance leg when walking and ahead when jogging.
      bones[spine].multiply(rotation.setFromAxisAngle(axisX, ground * lerp(0.14, 0.15, m.running)));
      bones[spine].multiply(rotation.setFromAxisAngle(axisZ, -steering * lerp(0.055, 0.13, m.running)));
      rotation.copy(bones[hips]).multiply(bones[spine]).multiply(bones[chest]);
      const counterTwist = ground * 0.72 * (hipLineAngle(rotation) + 0.62 * hipLineAngle(bones[hips]));
      bones[chest].multiply(rotation.setFromAxisAngle(axisY, counterTwist + steering * 0.13));
      const armClearance = 0.045 * ground * m.running;
      bones[leftArm].premultiply(rotation.setFromAxisAngle(axisZ, armClearance));
      bones[rightArm].premultiply(rotation.setFromAxisAngle(axisZ, -armClearance));
      bones[neck].multiply(rotation.setFromAxisAngle(axisY, steering * 0.15));
      // Let the neck absorb part of the captured trunk pitch so the actor
      // keeps their gaze along the route, including as the running torso leans.
      rotation.copy(bones[hips]).multiply(bones[spine]).multiply(bones[chest]).multiply(bones[neck]).multiply(bones[head]);
      const gazeY = 2 * (rotation.y * rotation.z - rotation.w * rotation.x);
      const nod = ground * (Math.asin(THREE.MathUtils.clamp(gazeY, -1, 1)) + 0.035);
      bones[neck].multiply(rotation.setFromAxisAngle(axisX, nod * 0.44));
      bones[head].multiply(rotation.setFromAxisAngle(axisX, nod * 0.25));
      pose.shift = lerp(lerp(walkCursor.curve(walk.shift), runCursor.curve(run.shift), m.running)
        * m.moving, jumpCursor.curve(jump.shift), m.jumpWeight) * (1 - m.swimming);
      pose.flight = runCursor.curve(run.flight) * m.running * m.moving * (1 - m.jumpWeight);
      pose.headAboveWater = m.swimming > 0 ? sampleSwim(bones, m.swimPhase, m.moving, m.swimming) : 0;
    },
  };
  return pose;
}

export interface SolePoint { bone: THREE.Object3D; local: THREE.Vector3; }

/** Keep the feet planted on land and the swimmer's head at the surface. On
 * the bank slope, ground contact can support the body before it fully floats. */
export function alignAvatar(visual: THREE.Group, soles: SolePoint[], head: THREE.Object3D, pelvis: THREE.Object3D) {
  const tmp = new THREE.Vector3();
  const anchor = new THREE.Vector3(), offset = new THREE.Vector3(), localOffset = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  let planted = -1;
  return (lift: number, headAboveWater: number, motion: AvatarMotion) => {
    const { swimming, waterFloor } = motion;
    const origin = visual.parent?.getWorldPosition(tmp).y ?? 0;
    if (motion.saddleHeight) {
      planted = -1;
      offset.set(0, 0, 0);
      visual.position.z = 0;
      visual.position.y += origin + motion.saddleHeight + 0.08 - pelvis.getWorldPosition(tmp).y;
      return;
    }
    let minY = Infinity, bedCorrection = -Infinity;
    const soleMargin = 0.004 + 0.022 * THREE.MathUtils.smoothstep(swimming, 0, 0.18);
    // Roll the loaded foot from heel to forefoot, keeping its active point
    // fixed in world space until toe-off. Release during swing and flight.
    const step = motion.phase % 0.5, end = lerp(0.485, 0.32, motion.running);
    const load = THREE.MathUtils.smoothstep(motion.moving, 0.025, 0.28)
      * (1 - THREE.MathUtils.smoothstep(motion.jumpWeight, 0, 0.22)) * (1 - THREE.MathUtils.smoothstep(swimming, 0, 0.24));
    const support = soles.length === 4 && step < end && load > 0;
    const marker = support ? (motion.phase < 0.5 ? 0 : 2) + Number(step > lerp(0.28, 0.165, motion.running)) : -1;
    visual.position.z = 0;
    for (let i = 0; i < soles.length; i++) {
      const { bone, local } = soles[i];
      bone.localToWorld(tmp.copy(local));
      if (i === marker) {
        if (planted !== marker) anchor.copy(tmp).add(offset);
        offset.subVectors(anchor, tmp);
        offset.y = 0;
        const release = 1 - THREE.MathUtils.smoothstep(step, end - 0.075, end);
        offset.clampLength(0, 0.075).multiplyScalar(release * load);
      }
      minY = Math.min(minY, tmp.y);
      if (waterFloor) bedCorrection = Math.max(bedCorrection, waterFloor(tmp.x, tmp.z) + soleMargin - tmp.y);
    }
    const footCorrection = soles.length ? origin + lift - minY : 0;
    const buoyancy = swimming > 0 ? origin + headAboveWater - head.getWorldPosition(tmp).y : 0;
    visual.position.y += Math.max(bedCorrection, lerp(footCorrection, buoyancy, swimming));
    planted = marker;
    if (!support) offset.set(0, 0, 0);
    if (support && visual.parent) {
      localOffset.copy(offset).applyQuaternion(visual.parent.getWorldQuaternion(parentRotation).invert());
      visual.position.x += localOffset.x;
      visual.position.z = localOffset.z;
    }
  };
}
