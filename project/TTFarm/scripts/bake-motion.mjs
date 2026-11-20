// Bake the three CMU subject 02 ASF/AMC captures to canonical, +Z-forward local
// rotations. Run with Node in the game container: node scripts/bake-motion.mjs <source directory>.
import fs from "node:fs";
import path from "node:path";
import { Euler, Vector3, Quaternion, Matrix4 } from "three";

const source = process.argv[2];
if (!source) throw new Error("Pass the directory containing CMU 02.asf and 02_01/03/04.amc");
const asf = fs.readFileSync(path.join(source, "02.asf"), "utf8").replaceAll("\r", "");
const degrees = Math.PI / 180;
const meters = 0.0254 / 0.45;
const vec = (a) => new Vector3(...a);
const quat = (a) => new Quaternion().setFromEuler(new Euler(...a.map(n => n * degrees), "ZYX"));
const joints = { root: { name: "root", parent: null, offset: new Vector3() } };
const [description, hierarchy] = asf.split(":hierarchy");
for (const block of description.split(":bonedata")[1].matchAll(/\bbegin\s+([\s\S]*?)\s+end\b/g)) {
  const fields = Object.fromEntries(block[1].trim().split("\n").map(s => {
    const [key, ...value] = s.trim().split(/\s+/);
    return [key, value];
  }));
  const name = fields.name[0];
  joints[name] = {
    name, offset: vec(fields.direction.map(Number)).multiplyScalar(Number(fields.length[0]) * meters),
    axis: quat(fields.axis.slice(0, 3).map(Number)), dof: fields.dof || [],
  };
}
for (const line of hierarchy.trim().split("\n").slice(1, -1)) {
  const [parent, ...children] = line.trim().split(/\s+/);
  for (const name of children) joints[name].parent = parent;
}

function forwardKinematics(frame) {
  const transforms = {};
  function bones(name) {
    if (transforms[name]) return transforms[name];
    const { parent, offset, dof, axis } = joints[name];
    let rotation, start;
    if (parent) {
      const p = bones(parent);
      const euler = [0, 0, 0];
      dof.forEach((axis, i) => { euler["xyz".indexOf(axis[1])] = frame[name][i]; });
      rotation = p.rotation.clone().multiply(axis).multiply(quat(euler)).multiply(axis.clone().invert());
      start = p.end;
    } else {
      rotation = quat(frame.root.slice(3));
      start = vec(frame.root).multiplyScalar(meters);
    }
    return transforms[name] = { rotation, start, end: offset.clone().applyQuaternion(rotation).add(start) };
  }
  for (const name of Object.keys(joints)) bones(name);
  return transforms;
}
function readCapture(take) {
  let frame;
  const frames = [];
  const amc = fs.readFileSync(path.join(source, `02_${take}.amc`), "utf8");
  for (const line of amc.trim().split(/\r?\n/)) {
    if (line.startsWith("#") || line.startsWith(":")) continue;
    if (/^\d+$/.test(line)) {
      frame = {};
      frames.push(frame);
    } else {
      const [bone, ...angles] = line.split(/\s+/);
      frame[bone] = angles.map(Number);
    }
  }
  return frames.map(forwardKinematics);
}
const [walk, run, jump] = ["01", "03", "04"].map(readCapture);
if (process.argv.includes("--inspect")) {
  for (const [name, frames] of Object.entries({walk,run,jump})) {
    console.log(name, frames.length);
    for (let i=0; i<frames.length; i+=8) {
      const f=frames[i];
      console.log(i, ...[f.root.start.y,f.root.start.z,f.lfoot.start.y,f.rfoot.start.y,
        f.lfoot.start.z-f.root.start.z,f.rfoot.start.z-f.root.start.z,
        f.ltoes.end.y, f.rtoes.end.y, f.lhand.start.y, f.lhand.start.z-f.root.start.z].map(v=>v.toFixed(2)));
    }
  }
  process.exit();
}


const tracks = [
  ["hips", "root"], ["spine","lowerback","hips"], ["chest","thorax","spine"],
  ["neck","lowerneck","chest"], ["head","head","neck"],
];
for (const [side, prefix, sign] of [["left","l",1],["right","r",-1]]) {
  // The ASF reference femurs splay out by 20°. A VRM T-pose has vertical legs.
  const legBasis = new Quaternion().setFromAxisAngle(new Vector3(0,0,1), sign * 20 * degrees);
  tracks.push(
    [side+"Shoulder",prefix+"clavicle","chest"],
    [side+"UpperArm",prefix+"humerus",side+"Shoulder"],
    [side+"LowerArm",prefix+"radius",side+"UpperArm"],
    [side+"Hand",prefix+"wrist",side+"LowerArm"],
    [side+"UpperLeg",prefix+"femur","hips",legBasis],
    [side+"LowerLeg",prefix+"tibia",side+"UpperLeg",legBasis],
    [side+"Foot",prefix+"foot",side+"LowerLeg",legBasis],
    [side+"Toes",prefix+"toes",side+"Foot",legBasis],
  );
}
function channelRotations(frame, heading) {
  const global = {};
  // ASF/Vicon humerus roll and a VRM T-pose have different rest twist. The measured
  // elbow plane defines the target hinge without transferring the actor's bind twist.
  const armBasis = {};
  for (const [prefix, sign] of [["l", 1], ["r", -1]]) {
    // The performer has wider shoulders than this avatar. A small clearance
    // angle keeps wrists outside the apron on the inward part of the backswing.
    const clearance = new Quaternion().setFromAxisAngle(new Vector3(0,0,1), sign * 0.10);
    const upper = frame[prefix+"humerus"], lower = frame[prefix+"radius"];
    const arm = upper.end.clone().sub(upper.start).normalize();
    const forearm = lower.end.clone().sub(lower.start).normalize();
    const x = arm.clone().multiplyScalar(sign);
    const z = forearm.clone().addScaledVector(arm, -forearm.dot(arm));
    if (z.lengthSq() < 0.001) z.set(0, 0, 1).addScaledVector(arm, -arm.z);
    z.normalize();
    const y = z.clone().cross(x).normalize();
    function orientation(direction) {
      const lateral = direction.clone().multiplyScalar(sign);
      const front = lateral.clone().cross(y).normalize();
      return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(lateral, y, front));
    }
    armBasis[prefix+"humerus"] = orientation(arm).premultiply(clearance);
    armBasis[prefix+"radius"] = orientation(forearm).premultiply(clearance);
    armBasis[prefix+"wrist"] = armBasis[prefix+"radius"];
  }
  return tracks.map(([bone, sourceBone, parent, basis]) => {
    const q = heading.clone().multiply(armBasis[sourceBone] ?? frame[sourceBone].rotation);
    if (basis) q.multiply(basis);
    global[bone] = q;
    return parent ? global[parent].clone().invert().multiply(q) : q;
  });
}

function bake(frames, start, end, intervals, cyclic = false) {
  const origin = frames[start].root.start;
  const travel = frames[end].root.start.clone().sub(origin);
  const heading = new Quaternion().setFromAxisAngle(new Vector3(0,1,0),
    cyclic ? -Math.atan2(travel.x, travel.z) : 0);
  const samples = [];
  const sideShifts = [], flights = [];
  for (let i = 0; i <= intervals; i++) {
    const fraction = i / intervals;
    const frame = frames[Math.round(start + fraction * (end - start))];
    samples.push(channelRotations(frame, heading));
    const deviation = frame.root.start.clone().sub(origin).addScaledVector(travel, -fraction).applyQuaternion(heading);
    sideShifts.push(Math.round(deviation.x * 1000));
    // Contact clearance in the jog's flight phase, with the capture's floor drift removed.
    const floor = 0.027 + (frame.root.start.z + 1) * 0.017;
    const clearance = Math.min(...["l","r"].map(p => Math.min(
      frame[p+"toes"].end.y - floor, frame[p+"foot"].start.y - .06 - floor)));
    flights.push(Math.round(1000 * Math.max(0, clearance)));
  }
  if (cyclic) {
    // Match pose and velocity at the wrap by crossfading into the next recorded stride.
    const overlap = Math.min(4, intervals);
    for (let i=0; i<=overlap; i++) {
      const k=intervals-overlap+i;
      const earlier=frames[Math.max(0,start-Math.round((overlap-i)*(end-start)/intervals))];
      const incoming=channelRotations(earlier,heading);
      const mix=i/overlap;
      samples[k].forEach((q,j)=>q.slerp(incoming[j],mix*mix*(3-2*mix)));
    }
    samples[intervals]=samples[0];
    flights[intervals]=flights[0];
  }
  // Signed 16-bit quaternions keep local rotations within 0.005 degrees of the capture.
  const bytes = Buffer.alloc(samples.length * tracks.length * 8);
  let cursor = 0;
  for (const pose of samples) for (const q of pose) for (const value of q.toArray()) {
    bytes.writeInt16LE(Math.round(value * 32767), cursor); cursor += 2;
  }
  return { count: samples.length, shift: sideShifts, flight: flights, rotations: bytes.toString("base64") };
}

const data = {
  bones: tracks.map(([name])=>name),
  idle: bake(jump, 450, 450, 1),
  walk: bake(walk, 134, 265, 33, true),
  run: bake(run, 48, 142, 24, true),
  jump: bake(jump, 32, 248, 54),
};
const output = new URL("../src/scene/locomotion.json", import.meta.url);
fs.writeFileSync(output, JSON.stringify(data) + "\n");
