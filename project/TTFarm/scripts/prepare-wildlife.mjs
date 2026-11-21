// Offline authoring, inside the development container:
// npm install --prefix /tmp/ttfarm-model-authoring @gltf-transform/core@4.2.1 @gltf-transform/extensions@4.2.1 @gltf-transform/functions@4.2.1 sharp@0.33.5 @xmldom/xmldom@0.8.12
// node scripts/prepare-wildlife.mjs /tmp/ttfarm-professional-originals /tmp/ttfarm-model-authoring
import assert from "node:assert/strict";
import { mkdir, rename, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStag } from "./prepare-stag.mjs";
import { derivePanda } from "./prepare-panda.mjs";

const [input, toolsDir, onlySpecies] = process.argv.slice(2);
if (!input || !toolsDir) throw new Error("Expected source GLB directory and offline tools directory");
const require = createRequire(path.resolve(toolsDir, "package.json"));
const { NodeIO, Logger, PropertyType } = require("@gltf-transform/core");
const { EXTTextureWebP } = require("@gltf-transform/extensions");
const { dedup, prune, resample } = require("@gltf-transform/functions");
const sharp = require("sharp");
const io = new NodeIO().registerExtensions([EXTTextureWebP]);
const output = fileURLToPath(new URL("../src/scene/professionalModels/", import.meta.url));
const species = [
  "wolf",
  "bear",
  "panda",
  "tiger",
  "lion",
  "elephant",
  "fox",
  "rabbit",
  "deer",
  "boar",
  "goat",
  "sheep",
  "horse",
  "cow",
];
const keepClips = new Set(["idle", "walk", "run", "feeding"]);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function unit(v) {
  const length = Math.hypot(...v);
  return length > 1e-10 ? v.map((n) => n / length) : [0, 0, 0];
}
function mean(a, b) {
  return a.map((x, i) => (x + b[i]) * 0.5);
}

function skinInfluences(joints, weights) {
  const byJoint = new Map();
  joints.forEach((id, i) => {
    if (weights[i] > 0) byJoint.set(id, (byJoint.get(id) ?? 0) + weights[i]);
  });
  return byJoint;
}
function encodeSkin(influences) {
  const bones = [...influences].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
  assert.ok(bones.length, "vertex with no skin influence");
  const total = bones.reduce((sum, bone) => sum + bone[1], 0);
  const scaled = bones.map((bone) => (bone[1] * 255) / total);
  const bytes = scaled.map(Math.floor);
  // Keep the normalized integer weights summing to exactly one.
  const order = bones.map((_, i) => i).sort((a, b) => scaled[b] - bytes[b] - (scaled[a] - bytes[a]));
  const left = 255 - bytes.reduce((sum, x) => sum + x, 0);
  for (let i = 0; i < left; i++) bytes[order[i]]++;
  return {
    joints: Array.from({ length: 4 }, (_, i) => (bytes[i] ? bones[i][0] : 0)),
    weights: Array.from({ length: 4 }, (_, i) => bytes[i] ?? 0),
  };
}

function refine(doc, prim) {
  assert.equal(prim.getMode(), 4);
  assert.equal(prim.listTargets().length, 0, "morph targets need their own subdivision");
  const semantics = prim.listSemantics();
  const attrs = Object.fromEntries(semantics.map((key) => [key, prim.getAttribute(key)]));
  const out = Object.fromEntries(semantics.map((key) => [key, []]));
  const count = attrs.POSITION.getCount();
  const original = Object.fromEntries(
    semantics.map((key) => [key, Array.from({ length: count }, (_, i) => attrs[key].getElement(i, []))]),
  );
  const skins = original.JOINTS_0.map((joints, i) => skinInfluences(joints, original.WEIGHTS_0[i]));
  const sharedNormals = new Map();
  const seam = original.POSITION.map((point, i) => {
    // UV islands may duplicate a vertex. Compute its curvature from the same position and rig,
    // while retaining its individual UV, color and shading normal on each side of the seam.
    const bones = [...skins[i]]
      .sort((a, b) => a[0] - b[0])
      .map(([j, w]) => j + ":" + Math.round(w * 1e5))
      .join(",");
    const key = point.join(",") + "/" + bones;
    const sum = sharedNormals.get(key) ?? [0, 0, 0];
    for (let c = 0; c < 3; c++) sum[c] += original.NORMAL[i][c];
    sharedNormals.set(key, sum);
    return key;
  });
  for (const [k, normal] of sharedNormals) sharedNormals.set(k, unit(normal));
  function writeSkin(bones) {
    const { joints, weights } = encodeSkin(bones);
    out.JOINTS_0.push(...joints);
    out.WEIGHTS_0.push(...weights);
  }
  const continuous = semantics.filter((key) => key !== "JOINTS_0" && key !== "WEIGHTS_0");
  for (let i = 0; i < count; i++) {
    for (const key of continuous)
      out[key].push(...(key === "NORMAL" ? unit(original.NORMAL[i]) : original[key][i]));
    writeSkin(skins[i]);
  }
  const mids = new Map(),
    indices = [];
  function midpoint(a, b) {
    const edge = Math.min(a, b) * count + Math.max(a, b);
    const existing = mids.get(edge);
    if (existing !== undefined) return existing;
    const id = out.POSITION.length / 3;
    mids.set(edge, id);
    const pa = original.POSITION[a],
      pb = original.POSITION[b],
      delta = pb.map((v, i) => v - pa[i]);
    const na = sharedNormals.get(seam[a]),
      nb = sharedNormals.get(seam[b]);
    // Project the midpoint onto the two endpoint tangent planes and blend their projections.
    const correction = na.map((v, i) => (dot(delta, nb) * nb[i] - dot(delta, na) * v) * 0.25);
    const scale = Math.min(0.72, (0.075 * Math.hypot(...delta)) / Math.max(1e-12, Math.hypot(...correction)));
    for (const key of continuous) {
      let value = mean(original[key][a], original[key][b]);
      if (key === "POSITION") value = value.map((x, i) => x + scale * correction[i]);
      if (key === "NORMAL") value = Math.hypot(...value) > 1e-8 ? unit(value) : unit(original.NORMAL[a]);
      out[key].push(...value);
    }
    const bones = new Map(skins[a]);
    for (const [id, w] of skins[b]) bones.set(id, (bones.get(id) ?? 0) + w);
    writeSkin(bones);
    return id;
  }
  const source = prim.getIndices()?.getArray() ?? Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < source.length; i += 3) {
    const a = source[i],
      b = source[i + 1],
      c = source[i + 2];
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      ca = midpoint(c, a);
    indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const buffer = attrs.POSITION.getBuffer();
  for (const key of semantics) {
    const values = out[key];
    let data;
    if (key === "JOINTS_0") data = new (attrs[key].getArray().constructor)(values);
    else if (key === "WEIGHTS_0") data = new Uint8Array(values);
    else if (key === "COLOR_0")
      data = Uint8Array.from(values, (x) => Math.round(255 * Math.min(1, Math.max(0, x))));
    else data = new Float32Array(values);
    const acc = doc
      .createAccessor(key)
      .setBuffer(buffer)
      .setType(attrs[key].getType())
      .setArray(data)
      .setNormalized(key === "WEIGHTS_0" || key === "COLOR_0");
    prim.setAttribute(key, acc);
  }
  const Index = out.POSITION.length / 3 > 65535 ? Uint32Array : Uint16Array;
  prim.setIndices(doc.createAccessor().setType("SCALAR").setBuffer(buffer).setArray(new Index(indices)));
  return indices.length / 3;
}

function stripRestTracks(animation) {
  // Some original clips key the complete rest transform of every attachment and hair joint.
  // Three's action mixer already uses the rest pose for a joint an action doesn't animate.
  const channels = animation.listChannels();
  const duration = (channel) => channel.getSampler().getInput().getMax([])[0];
  const end = Math.max(...channels.map(duration));
  const atRest = channels.filter((channel) => {
    const sampler = channel.getSampler(),
      bone = channel.getTargetNode(),
      target = channel.getTargetPath();
    if (sampler.getInterpolation() === "CUBICSPLINE" || target === "weights") return false;
    const rest =
      target === "rotation"
        ? bone.getRotation()
        : target === "scale"
          ? bone.getScale()
          : bone.getTranslation();
    const output = sampler.getOutput(),
      frame = [];
    for (let i = 0; i < output.getCount(); i++) {
      output.getElement(i, frame);
      const sign = target === "rotation" && frame.reduce((s, x, j) => s + x * rest[j], 0) < 0 ? -1 : 1;
      if (rest.some((x, j) => Math.abs(frame[j] * sign - x) > 1e-6)) return false;
    }
    return true;
  });
  const drop = new Set(atRest);
  if (!channels.some((channel) => !drop.has(channel) && duration(channel) >= end)) {
    drop.delete(channels.find((channel) => duration(channel) === end));
  }
  for (const channel of drop) channel.dispose();
  const used = new Set(animation.listChannels().map((channel) => channel.getSampler()));
  for (const sampler of animation.listSamplers()) if (!used.has(sampler)) sampler.dispose();
}

await mkdir(output, { recursive: true });
if (onlySpecies) assert.ok(species.includes(onlySpecies), "Unknown animal");
for (const kind of onlySpecies ? [onlySpecies] : species) {
  const source = kind === "panda" ? "bear" : kind;
  const doc =
    kind === "deer" ? await readStag(input, require) : await io.read(path.resolve(input, source + ".glb"));
  if (kind === "panda") await derivePanda(doc, sharp);
  const root = doc.getRoot();
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const meshes = root.listMeshes().length,
    skins = root.listSkins().length;
  const originalNotes = root.getAsset().copyright;
  let triangles = 0;
  for (const animation of root.listAnimations()) {
    if (keepClips.has(animation.getName())) stripRestTracks(animation);
    else animation.dispose();
  }
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) triangles += refine(doc, prim);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const texture of root.listTextures()) {
    const image = sharp(texture.getImage());
    const normal = root.listMaterials().some((material) => material.getNormalTexture() === texture);
    const bytes = await image
      .webp({ quality: 93, alphaQuality: 100, lossless: normal, effort: 6 })
      .toBuffer();
    texture.setImage(bytes).setMimeType("image/webp");
  }
  await doc.transform(
    resample({ tolerance: 1e-7, cleanup: false }),
    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
    prune({ keepLeaves: true, keepAttributes: true, keepSolidTextures: true, keepExtras: true }),
  );
  const name = path.join(output, kind + ".glb"),
    temporary = name + ".tmp.glb";
  await io.write(temporary, doc);
  const check = (await io.read(temporary)).getRoot();
  assert.equal(check.listMeshes().length, meshes);
  assert.equal(check.listSkins().length, skins);
  assert.equal(check.getAsset().copyright, originalNotes);
  assert.ok(check.listAnimations().some((a) => a.getName() === "walk"));
  assert.ok(check.listTextures().every((texture) => texture.getMimeType() === "image/webp"));
  await rename(temporary, name);
  console.log(kind, triangles + " triangles", Math.round((await stat(name)).size / 1024) + " KiB");
}
