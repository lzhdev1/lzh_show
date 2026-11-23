import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { ActionId } from "./rig";

/** 动作元数据：duration 为 null 表示持续到玩家移动或主动取消。 */
export const ACTIONS: Record<ActionId, { label: string; icon: string; key: string; duration: number | null; fade: number; hidden?: boolean }> = {
  punch: { label: "出拳", icon: "👊", key: "J", duration: 0.62, fade: 0.08 },
  kick:  { label: "踢腿", icon: "🦵", key: "K", duration: 0.78, fade: 0.08 },
  cheer: { label: "欢呼", icon: "🙌", key: "C", duration: null, fade: 0.25 },
  dance: { label: "跳舞", icon: "💃", key: "X", duration: null, fade: 0.3 },
  sit:   { label: "坐下", icon: "🪑", key: "Z", duration: null, fade: 0.4 },
  lie:   { label: "躺下", icon: "🛌", key: "V", duration: null, fade: 0.5 },
  faint: { label: "晕倒", icon: "💫", key: "B", duration: null, fade: 0.12 },
  fishWait: { label: "持竿", icon: "🎣", key: "F6", duration: null, fade: 0.22, hidden: true },
  fishCast: { label: "抛竿", icon: "🎣", key: "F7", duration: 0.92, fade: 0.1, hidden: true },
  fishReel: { label: "遛鱼", icon: "🎣", key: "F8", duration: null, fade: 0.14, hidden: true },
};
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];
export const MENU_ACTION_IDS = ACTION_IDS.filter((id) => !ACTIONS[id].hidden);

export function isActionId(value: unknown): value is ActionId {
  return typeof value === "string" && value in ACTIONS;
}

/** 淡入 + 一次性动作的淡出；好友端与本地共用，保证观感一致。 */
export function actionWeight(id: ActionId, time: number): number {
  const meta = ACTIONS[id];
  const fadeIn = smooth(time, 0, meta.fade);
  if (meta.duration === null) return fadeIn;
  return fadeIn * (1 - smooth(time, meta.duration - 0.18, meta.duration));
}

function smooth(x: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

type V3 = [number, number, number];
/** 手臂用身体坐标系的方向向量瞄准：+y 上、+z 前，x 由左右符号翻转。 */
interface PoseSpec {
  hips?: V3; spine?: V3; chest?: V3; neck?: V3; head?: V3;
  leftUpperLeg?: V3; leftLowerLeg?: V3; leftFoot?: V3;
  rightUpperLeg?: V3; rightLowerLeg?: V3; rightFoot?: V3;
  leftArm?: [V3, V3]; rightArm?: [V3, V3];
}
interface Key { t: number; p?: PoseSpec; lift?: number; shift?: number }

const EULER_BONES = ["hips", "spine", "chest", "neck", "head",
  "leftUpperLeg", "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot"] as const;

function armQuats(sign: number, upper: V3, lower: V3, outUpper: Quaternion, outLower: Quaternion) {
  const u = new Vector3(sign * upper[0], upper[1], upper[2]).normalize();
  const l = new Vector3(sign * lower[0], lower[1], lower[2]).normalize();
  const y = l.clone().cross(u).multiplyScalar(sign);
  if (y.lengthSq() < 1e-8) y.set(0, 1, 0).cross(u); // 完全伸直时取任意正交轴
  y.normalize();
  const frame = (dir: Vector3, out: Quaternion) => {
    const x = dir.clone().multiplyScalar(sign);
    out.setFromRotationMatrix(new Matrix4().makeBasis(x, y, x.clone().cross(y)));
  };
  frame(u, outUpper);
  frame(l, outLower);
  outLower.premultiply(outUpper.clone().invert());
}

interface CompiledKey { t: number; joints: Quaternion[]; lift: number; shift: number }
interface CompiledAction { keys: CompiledKey[]; bones: number[]; cycle: number | null }

function compile(bones: string[], base: PoseSpec, keys: Key[], cycle: number | null): CompiledAction {
  const animated = new Set<number>();
  const idx = (name: string) => bones.indexOf(name);
  const compiled = keys.map(key => {
    const spec: PoseSpec = { ...base, ...key.p };
    const joints = bones.map(() => new Quaternion());
    const euler = new Euler();
    for (const name of EULER_BONES) {
      const v = spec[name];
      if (!v) continue;
      animated.add(idx(name));
      joints[idx(name)].setFromEuler(euler.set(v[0], v[1], v[2]));
    }
    for (const [side, sign] of [["left", 1], ["right", -1]] as const) {
      const aim = spec[side === "left" ? "leftArm" : "rightArm"];
      if (!aim) continue;
      animated.add(idx(side + "UpperArm"));
      animated.add(idx(side + "LowerArm"));
      armQuats(sign, aim[0], aim[1], joints[idx(side + "UpperArm")], joints[idx(side + "LowerArm")]);
    }
    return { t: key.t, joints, lift: key.lift ?? 0, shift: key.shift ?? 0 };
  });
  return { keys: compiled, bones: [...animated], cycle };
}

// —— 各动作关键帧。骨骼局部约定与 swimMotion/ridingPose 一致：
//    大腿负俯仰=向前抬，小腿正俯仰=膝盖弯曲，躯干正俯仰=前倾。 ——

const stance: PoseSpec = {
  hips: [0.015, 0, 0], spine: [0.035, 0, 0], chest: [0.025, 0, 0], neck: [-0.035, 0, 0], head: [-0.035, 0, 0],
  leftUpperLeg: [-0.065, 0, 0.047], leftLowerLeg: [0.1, 0, 0], leftFoot: [-0.05, 0.065, -0.047],
  rightUpperLeg: [-0.065, 0, -0.047], rightLowerLeg: [0.1, 0, 0], rightFoot: [-0.05, -0.065, 0.047],
};
const guardArms: PoseSpec = {
  leftArm: [[0.35, -0.55, 0.75], [0.2, 0.35, 0.9]],
  rightArm: [[0.45, -0.6, 0.65], [0.25, 0.3, 0.9]],
};

const punch = compile2(["punch"], () => ({
  base: { ...stance, ...guardArms },
  keys: [
    { t: 0 },
    { t: 0.16, p: { chest: [0.05, 0.3, 0], hips: [0.02, 0.12, 0],
      rightArm: [[0.7, -0.45, -0.55], [0.3, 0.2, -0.9]] } },
    { t: 0.3, p: { spine: [0.14, 0, 0], chest: [0.06, -0.34, 0], hips: [0.06, -0.1, 0], head: [-0.03, -0.1, 0],
      rightArm: [[0.12, -0.06, 1], [0.06, -0.14, 1]],
      leftArm: [[0.3, -0.5, 0.8], [0.2, 0.4, 0.85]] } },
    { t: 0.62 },
  ],
  cycle: null,
}));

const kick = compile2(["kick"], () => ({
  base: { ...stance,
    leftArm: [[0.3, -0.8, 0.2], [0.2, -0.9, 0.3]],
    rightArm: [[0.3, -0.8, 0.2], [0.2, -0.9, 0.3]] },
  keys: [
    { t: 0 },
    { t: 0.2, p: { hips: [-0.08, 0, 0], rightUpperLeg: [-1.55, 0, -0.08], rightLowerLeg: [1.7, 0, 0], rightFoot: [0.3, 0, 0],
      leftArm: [[0.8, -0.3, 0.2], [0.7, -0.5, 0.3]], rightArm: [[0.7, -0.4, -0.3], [0.6, -0.6, -0.2]] } },
    { t: 0.4, p: { hips: [-0.22, 0, 0], spine: [-0.1, 0, 0], rightUpperLeg: [-1.35, 0, -0.05], rightLowerLeg: [0.12, 0, 0], rightFoot: [-0.35, 0, 0],
      leftArm: [[0.6, -0.5, -0.4], [0.5, -0.7, -0.3]], rightArm: [[0.6, -0.5, -0.4], [0.5, -0.7, -0.3]] } },
    { t: 0.78 },
  ],
  cycle: null,
}));

const cheer = compile2(["cheer"], () => ({
  base: { ...stance, spine: [-0.06, 0, 0], neck: [-0.1, 0, 0], head: [-0.12, 0, 0],
    leftArm: [[0.5, 0.85, 0.05], [0.3, 0.95, 0.02]],
    rightArm: [[0.5, 0.85, 0.05], [0.3, 0.95, 0.02]] },
  keys: [
    { t: 0, lift: 0 },
    { t: 0.25, lift: 0.16, p: { leftUpperLeg: [-0.35, 0, 0.06], leftLowerLeg: [0.5, 0, 0],
      rightUpperLeg: [-0.35, 0, -0.06], rightLowerLeg: [0.5, 0, 0],
      leftArm: [[0.7, 0.7, 0], [0.5, 0.86, 0]], rightArm: [[0.7, 0.7, 0], [0.5, 0.86, 0]] } },
    { t: 0.5, lift: 0 },
    { t: 0.75, lift: 0.16, p: { leftUpperLeg: [-0.35, 0, 0.06], leftLowerLeg: [0.5, 0, 0],
      rightUpperLeg: [-0.35, 0, -0.06], rightLowerLeg: [0.5, 0, 0],
      leftArm: [[0.65, 0.75, 0.1], [0.45, 0.88, 0.05]], rightArm: [[0.65, 0.75, 0.1], [0.45, 0.88, 0.05]] } },
    { t: 1, lift: 0 },
  ],
  cycle: 1.4,
}));

const dance = compile2(["dance"], () => ({
  base: { ...stance },
  keys: [
    { t: 0, lift: 0.02, shift: -0.05, p: { hips: [0.02, 0.1, 0.16], chest: [0.02, -0.18, -0.08], head: [-0.03, 0.1, -0.1],
      leftUpperLeg: [-0.2, 0, 0.1], leftLowerLeg: [0.3, 0, 0], rightUpperLeg: [-0.05, 0, -0.05], rightLowerLeg: [0.1, 0, 0],
      leftArm: [[0.45, 0.7, 0.2], [0.3, 0.9, 0.1]], rightArm: [[0.75, -0.45, 0.25], [0.6, -0.7, 0.3]] } },
    { t: 0.25, lift: 0.09, shift: 0, p: { hips: [0.06, 0, 0], chest: [0.04, 0, 0], head: [0.05, 0, 0],
      leftUpperLeg: [-0.3, 0, 0.06], leftLowerLeg: [0.45, 0, 0], rightUpperLeg: [-0.3, 0, -0.06], rightLowerLeg: [0.45, 0, 0],
      leftArm: [[0.6, 0.2, 0.5], [0.4, 0.5, 0.7]], rightArm: [[0.6, 0.2, 0.5], [0.4, 0.5, 0.7]] } },
    { t: 0.5, lift: 0.02, shift: 0.05, p: { hips: [0.02, -0.1, -0.16], chest: [0.02, 0.18, 0.08], head: [-0.03, -0.1, 0.1],
      rightUpperLeg: [-0.2, 0, -0.1], rightLowerLeg: [0.3, 0, 0], leftUpperLeg: [-0.05, 0, 0.05], leftLowerLeg: [0.1, 0, 0],
      rightArm: [[0.45, 0.7, 0.2], [0.3, 0.9, 0.1]], leftArm: [[0.75, -0.45, 0.25], [0.6, -0.7, 0.3]] } },
    { t: 0.75, lift: 0.09, shift: 0, p: { hips: [0.06, 0, 0], chest: [0.04, 0, 0], head: [0.05, 0, 0],
      leftUpperLeg: [-0.3, 0, 0.06], leftLowerLeg: [0.45, 0, 0], rightUpperLeg: [-0.3, 0, -0.06], rightLowerLeg: [0.45, 0, 0],
      leftArm: [[0.6, -0.2, 0.6], [0.5, 0.3, 0.8]], rightArm: [[0.6, -0.2, 0.6], [0.5, 0.3, 0.8]] } },
    { t: 1, lift: 0.02, shift: -0.05, p: { hips: [0.02, 0.1, 0.16], chest: [0.02, -0.18, -0.08], head: [-0.03, 0.1, -0.1],
      leftUpperLeg: [-0.2, 0, 0.1], leftLowerLeg: [0.3, 0, 0], rightUpperLeg: [-0.05, 0, -0.05], rightLowerLeg: [0.1, 0, 0],
      leftArm: [[0.45, 0.7, 0.2], [0.3, 0.9, 0.1]], rightArm: [[0.75, -0.45, 0.25], [0.6, -0.7, 0.3]] } },
  ],
  cycle: 2.4,
}));

const lyingBase: PoseSpec = {
  hips: [-1.5, 0.05, 0], spine: [-0.06, 0, 0], chest: [-0.04, 0, 0], neck: [0.05, 0, 0], head: [0, 0, 0.12],
  leftUpperLeg: [-0.12, 0, 0.08], leftLowerLeg: [0.18, 0, 0], leftFoot: [0.1, 0, 0],
  rightUpperLeg: [-0.12, 0, -0.08], rightLowerLeg: [0.18, 0, 0], rightFoot: [0.1, 0, 0],
  leftArm: [[0.85, -0.25, 0.1], [0.9, -0.35, 0.15]],
  rightArm: [[0.85, -0.25, 0.1], [0.9, -0.35, 0.15]],
};
const lie = compile2(["lie"], () => ({
  base: lyingBase,
  keys: [{ t: 0, lift: 0.22 }, { t: 1, lift: 0.22 }],
  cycle: null,
}));

const faint = compile2(["faint"], () => ({
  base: stance,
  keys: [
    { t: 0, p: { chest: [0, 0, 0.15], head: [0, 0, -0.2], hips: [-0.05, 0, 0],
      leftArm: [[0.5, 0.6, 0.2], [0.4, 0.8, 0.1]], rightArm: [[0.5, 0.6, 0.2], [0.4, 0.8, 0.1]] } },
    { t: 0.3, p: { hips: [-0.55, 0, 0.06], spine: [-0.2, 0, 0], head: [0, 0, -0.25],
      leftUpperLeg: [-0.75, 0, 0.1], leftLowerLeg: [1.35, 0, 0], rightUpperLeg: [-0.75, 0, -0.1], rightLowerLeg: [1.35, 0, 0],
      leftArm: [[0.6, 0.5, 0.3], [0.5, 0.7, 0.2]], rightArm: [[0.6, 0.5, 0.3], [0.5, 0.7, 0.2]] } },
    { t: 0.65, lift: 0.1, p: { hips: [-1.15, 0, 0], spine: [-0.1, 0, 0],
      leftUpperLeg: [-0.5, 0, 0.12], leftLowerLeg: [0.7, 0, 0], rightUpperLeg: [-0.5, 0, -0.12], rightLowerLeg: [0.7, 0, 0],
      leftArm: [[0.8, 0.2, 0.2], [0.85, 0.1, 0.25]], rightArm: [[0.8, 0.2, 0.2], [0.85, 0.1, 0.25]] } },
    { t: 1.15, lift: 0.22, p: { ...lyingBase, head: [0, 0, 0.25],
      leftArm: [[0.95, -0.1, 0.25], [0.95, -0.2, 0.3]], rightArm: [[0.95, -0.1, 0.25], [0.95, -0.2, 0.3]] } },
  ],
  cycle: null,
}));

const sit = compile2(["sit"], () => ({
  base: { ...stance, hips: [-0.1, 0, 0], spine: [0.05, 0, 0], chest: [0.03, 0, 0], neck: [0.02, 0, 0], head: [0, 0, 0],
    leftUpperLeg: [-1.32, 0, 0.12], leftLowerLeg: [1.18, 0, 0], leftFoot: [-0.12, 0, 0],
    rightUpperLeg: [-1.32, 0, -0.12], rightLowerLeg: [1.18, 0, 0], rightFoot: [-0.12, 0, 0],
    leftArm: [[0.3, -0.7, 0.62], [0.15, -0.35, 0.92]],
    rightArm: [[0.3, -0.7, 0.62], [0.15, -0.35, 0.92]] },
  keys: [{ t: 0 }, { t: 1 }],
  cycle: null,
}));

// —— 钓鱼动作：右手持竿前伸，左手扶轮；抛竿时从背后抡到前方，遛鱼时后仰角力 ——
const fishWait = compile2(["fishWait"], () => ({
  base: {
    ...stance,
    hips: [0.02, 0, 0], spine: [0.06, 0, 0], chest: [0.04, 0, 0], neck: [-0.02, 0, 0], head: [-0.05, 0, 0],
    leftUpperLeg: [-0.08, 0, 0.07], leftLowerLeg: [0.14, 0, 0],
    rightUpperLeg: [-0.08, 0, -0.07], rightLowerLeg: [0.14, 0, 0],
    leftArm: [[0.52, -0.36, 0.58], [0.24, -0.18, 0.9]],
    rightArm: [[0.28, 0.24, 0.92], [0.12, 0.08, 0.99]],
  },
  keys: [
    { t: 0, p: { spine: [0.05, 0, 0] }, lift: 0 },
    { t: 0.5, p: { spine: [0.075, 0, 0], head: [-0.06, 0.03, 0], rightArm: [[0.28, 0.3, 0.9], [0.12, 0.12, 0.99]] }, lift: 0.012 },
    { t: 1, p: { spine: [0.05, 0, 0] }, lift: 0 },
  ],
  cycle: 3.2,
}));

const fishCast = compile2(["fishCast"], () => ({
  base: {
    ...stance, hips: [0.02, 0, 0], spine: [0.04, 0, 0], chest: [0.03, 0, 0],
    leftUpperLeg: [-0.12, 0, 0.08], leftLowerLeg: [0.2, 0, 0],
    rightUpperLeg: [-0.12, 0, -0.08], rightLowerLeg: [0.2, 0, 0],
    leftArm: [[0.45, -0.1, 0.55], [0.22, 0.15, 0.86]],
    rightArm: [[0.25, -0.25, -0.55], [0.18, -0.1, -0.65]],
  },
  keys: [
    { t: 0, p: { spine: [0.02, 0, 0], chest: [0.02, 0, 0], head: [-0.02, 0, 0] }, lift: 0 },
    { t: 0.28, p: { spine: [-0.12, 0, 0], chest: [-0.04, 0, 0], head: [0.08, 0, 0],
      rightArm: [[0.28, 0.85, 0.18], [0.14, 0.95, 0.12]], leftArm: [[0.55, 0.1, 0.45], [0.3, 0.3, 0.8]] }, lift: 0.03 },
    { t: 0.55, p: { spine: [0.16, 0, 0], chest: [0.06, 0, 0], head: [-0.1, 0, 0],
      rightUpperLeg: [-0.22, 0, -0.08], rightLowerLeg: [0.34, 0, 0],
      rightArm: [[0.2, 0.08, 0.96], [0.08, 0.02, 1]], leftArm: [[0.4, -0.42, 0.7], [0.16, -0.2, 0.94]] }, lift: 0 },
    { t: 0.92, p: {
      rightArm: [[0.28, 0.22, 0.92], [0.12, 0.06, 0.99]],
      leftArm: [[0.5, -0.36, 0.58], [0.24, -0.18, 0.9]] } },
  ],
  cycle: null,
}));

const fishReel = compile2(["fishReel"], () => ({
  base: {
    ...stance, hips: [-0.04, 0, 0], spine: [-0.12, 0, 0], chest: [-0.04, 0, 0], neck: [0.04, 0, 0], head: [0.06, 0, 0],
    leftUpperLeg: [-0.16, 0, 0.08], leftLowerLeg: [0.26, 0, 0],
    rightUpperLeg: [-0.24, 0, -0.09], rightLowerLeg: [0.32, 0, 0],
    leftArm: [[0.4, -0.25, 0.55], [0.15, 0.05, 0.86]],
    rightArm: [[0.2, 0.16, 0.94], [0.1, 0.05, 1]],
  },
  keys: [
    { t: 0, p: { spine: [-0.1, 0, 0], hips: [-0.03, 0, 0], leftArm: [[0.45, -0.12, 0.58], [0.16, 0.15, 0.83]] } },
    { t: 0.33, p: { spine: [-0.18, 0.06, 0], hips: [-0.1, 0.02, 0], head: [0.1, 0.04, 0],
      leftArm: [[0.38, -0.45, 0.52], [0.12, -0.2, 0.86]] } },
    { t: 0.66, p: { spine: [-0.09, -0.05, 0], hips: [-0.02, -0.02, 0], head: [0.03, -0.03, 0],
      leftArm: [[0.46, 0.05, 0.62], [0.18, 0.28, 0.82]] } },
    { t: 1, p: { spine: [-0.1, 0, 0], hips: [-0.03, 0, 0], leftArm: [[0.45, -0.12, 0.58], [0.16, 0.15, 0.83]] } },
  ],
  cycle: 1.1,
}));


// compile2 只是把定义延迟到骨骼名已知时再编译。
function compile2(_names: string[], build: () => { base: PoseSpec; keys: Key[]; cycle: number | null }) {
  return (bones: string[]) => compile(bones, build().base, build().keys, build().cycle);
}

const builders: Record<ActionId, (bones: string[]) => CompiledAction> = {
  punch, kick, cheer, dance, lie, faint, sit, fishWait, fishCast, fishReel,
};

/** 与 swimStroke 同一套路：关键帧预编译，采样只做四元数混合，无逐帧分配。 */
export function createActionSampler(bones: string[]) {
  const clips = Object.fromEntries(ACTION_IDS.map(id => [id, builders[id](bones)])) as Record<ActionId, CompiledAction>;
  const tmp = new Quaternion(), overlay = new Quaternion();
  const axisZ = new Vector3(0, 0, 1), axisX = new Vector3(1, 0, 0);
  const upperL = bones.indexOf("leftUpperArm"), upperR = bones.indexOf("rightUpperArm");
  const headIdx = bones.indexOf("head");
  return (target: Quaternion[], id: ActionId, time: number, weight: number) => {
    const clip = clips[id];
    const t = clip.cycle ? (time % clip.cycle) / clip.cycle : Math.min(time, clip.keys[clip.keys.length - 1].t);
    let i = 0;
    while (i < clip.keys.length - 2 && t > clip.keys[i + 1].t) i++;
    const a = clip.keys[i], b = clip.keys[i + 1];
    const u = smooth(t, a.t, b.t);
    for (const j of clip.bones) {
      tmp.slerpQuaternions(a.joints[j], b.joints[j], u);
      target[j].slerp(tmp, weight);
    }
    // 程序化叠加：欢呼挥手、跳舞点头、晕倒后的眩晕摇晃。
    if (id === "cheer") {
      const wave = Math.sin(time * 7) * 0.22 * weight;
      target[upperL].premultiply(overlay.setFromAxisAngle(axisZ, wave));
      target[upperR].premultiply(overlay.setFromAxisAngle(axisZ, -wave));
    } else if (id === "dance") {
      target[headIdx].multiply(overlay.setFromAxisAngle(axisX, Math.sin(time * 5) * 0.06 * weight));
    } else if (id === "faint" && time > 1.15) {
      target[headIdx].multiply(overlay.setFromAxisAngle(axisZ, Math.sin(time * 2.4) * 0.09 * weight));
      target[upperL].premultiply(overlay.setFromAxisAngle(axisZ, Math.sin(time * 1.7) * 0.04 * weight));
    }
    return { lift: (a.lift + (b.lift - a.lift) * u) * weight, shift: (a.shift + (b.shift - a.shift) * u) * weight };
  };
}