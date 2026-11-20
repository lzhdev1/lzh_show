import { Euler, Matrix4, Quaternion, Vector3 } from "three";

type Direction = [number, number, number];
type Stroke = {
  time: number;
  pitch: number;
  lift: number;
  arm: Direction;
  forearm: Direction;
  thigh: number;
  knee: number;
  spread: number;
  heelOut: number;
};

// Local Y points towards the swimmer's head, local Z towards their chest.
// Elbows bend during the insweep; the heels recover later than the hands,
// so the kick accelerates the body into the next glide.
const glide: Stroke = { time: 0, pitch: 1.38, lift: 0.012, arm: [0.19, 0.86, 0.48],
  forearm: [-0.17, 0.83, 0.53], thigh: -0.02, knee: 0.12, spread: 0.08, heelOut: 0 };
const strokes: Stroke[] = [
  glide,
  { time: 0.23, pitch: 1.31, lift: 0.026, arm: [0.72, 0.67, 0.16],
    forearm: [0.60, 0.59, 0.54], thigh: 0.01, knee: 0.18, spread: 0.10, heelOut: 0.03 },
  { time: 0.43, pitch: 1.06, lift: 0.086, arm: [0.91, 0.00, 0.41],
    forearm: [-0.66, 0.37, 0.65], thigh: -0.30, knee: 1.02, spread: 0.16, heelOut: 0.21 },
  { time: 0.58, pitch: 1.10, lift: 0.072, arm: [0.56, -0.54, 0.63],
    forearm: [-0.55, 0.82, 0.16], thigh: -0.61, knee: 1.77, spread: 0.27, heelOut: 0.39 },
  { time: 0.76, pitch: 1.35, lift: 0.020, arm: [0.21, 0.89, 0.41],
    forearm: [-0.18, 0.97, -0.10], thigh: -0.13, knee: 0.60, spread: 0.31, heelOut: 0.24 },
  { ...glide, time: 0.91 }, { ...glide, time: 1 },
];
const scull: Stroke[] = [
  { time: 0, pitch: 0.25, lift: 0.026, arm: [0.68, -0.68, 0.28],
    forearm: [0.70, -0.04, 0.71], thigh: -0.98, knee: 2.02, spread: 0.22, heelOut: 0.18 },
  { time: 1, pitch: 0.22, lift: 0.046, arm: [0.47, -0.73, 0.50],
    forearm: [-0.47, 0.04, 0.88], thigh: -0.74, knee: 1.82, spread: 0.29, heelOut: 0.10 },
];

function rotation(x: number, y = 0, z = 0) {
  return new Quaternion().setFromEuler(new Euler(x, y, z));
}

function armFrames(sign: number, arm: Direction, forearm: Direction) {
  const upper = new Vector3(sign * arm[0], arm[1], arm[2]).normalize();
  const lower = new Vector3(sign * forearm[0], forearm[1], forearm[2]).normalize();
  // Choose the humerus twist from the elbow plane just as for the retargeted
  // land clips. The forearm then folds around its hinge instead of rolling.
  const y = lower.clone().cross(upper).multiplyScalar(sign).normalize();
  const frame = (direction: Vector3) => {
    const x = direction.clone().multiplyScalar(sign);
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, x.clone().cross(y)));
  };
  const shoulder = frame(upper);
  return [shoulder, shoulder.clone().invert().multiply(frame(lower))];
}

function keyframe(bones: string[], s: Stroke) {
  const q: Record<string, Quaternion> = {
    hips: rotation(s.pitch), spine: rotation(-s.pitch * 0.12), chest: rotation(-s.pitch * 0.14),
    neck: rotation(-s.pitch * 0.27), head: rotation(-s.pitch * 0.17),
  };
  for (const [side, sign] of [["left", 1], ["right", -1]] as const) {
    const [upper, lower] = armFrames(sign, s.arm, s.forearm);
    q[side+"UpperArm"] = upper;
    q[side+"LowerArm"] = lower;
    q[side+"UpperLeg"] = rotation(s.thigh, -sign * s.heelOut * 0.6, sign * s.spread);
    q[side+"LowerLeg"] = rotation(s.knee, 0, sign * s.heelOut);
    q[side+"Foot"] = rotation(0.22 - s.heelOut, sign * s.heelOut);
  }
  return { ...s, joints: bones.map(name => q[name] ?? new Quaternion()) };
}

/** All stroke keyframes are prepared once; sampling only blends quaternions. */
export function createSwimStroke(bones: string[]) {
  const keys = strokes.map(s => keyframe(bones, s));
  const [out, inward] = scull.map(s => keyframe(bones, s));
  const leftLeg = bones.map(name => /^left(UpperLeg|LowerLeg|Foot)/.test(name));
  const reach = new Quaternion(), tread = new Quaternion();
  return (target: Quaternion[], phase: number, moving: number, weight: number) => {
    let i = 0;
    while (i < keys.length - 2 && phase > keys[i + 1].time) i++;
    const a = keys[i], b = keys[i + 1];
    const u = (phase - a.time) / (b.time - a.time);
    const t = u * u * (3 - 2 * u);
    const scoop = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
    for (let j = 0; j < target.length; j++) {
      reach.slerpQuaternions(a.joints[j], b.joints[j], t);
      tread.slerpQuaternions(out.joints[j], inward.joints[j], leftLeg[j] ? 1 - scoop : scoop);
      target[j].slerp(tread.slerp(reach, moving), weight);
    }
    const restLift = out.lift + (inward.lift - out.lift) * scoop;
    return restLift + (a.lift + (b.lift - a.lift) * t - restLift) * moving;
  };
}
