// The library GLB mixes a transform-baked mesh with the original COLLADA pose
// channels. Build this one animal from the matching rig, bind shape and clips.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Matrix4, Quaternion, Vector3 } from "three";

const art =
  "https://raw.githubusercontent.com/0ad/0ad/61a3b9507d974084e6badb88a0826bd89a6d5b8b/binaries/data/mods/public/art/";
const all = (el, tag) => Array.from(el.getElementsByTagName(tag));
const child = (el, tag) => Array.from(el.childNodes).filter((x) => x.tagName === tag);
const first = (el, tag) => all(el, tag)[0];
const numbers = (el) => el.textContent.trim().split(/\s+/).map(Number);
const matrix = (values) => new Matrix4().set(...values);
const up = new Matrix4().makeRotationX(-Math.PI / 2);

function nodeTransform(xml) {
  const m = new Matrix4();
  for (const el of Array.from(xml.childNodes)) {
    if (el.tagName === "matrix") m.multiply(matrix(numbers(el)));
    if (el.tagName === "translate") m.multiply(new Matrix4().makeTranslation(...numbers(el)));
    if (el.tagName === "scale") m.multiply(new Matrix4().makeScale(...numbers(el)));
    if (el.tagName === "rotate") {
      const [x, y, z, degrees] = numbers(el);
      m.multiply(new Matrix4().makeRotationAxis(new Vector3(x, y, z).normalize(), (degrees * Math.PI) / 180));
    }
  }
  return m;
}

function getWeights(skin) {
  const table = numbers(
    first(
      all(skin, "source").find((s) => s.getAttribute("id").endsWith("-weights")),
      "float_array",
    ),
  );
  const counts = numbers(first(skin, "vcount")),
    pairs = numbers(first(skin, "v"));
  let offset = 0;
  return counts.map((count) => {
    const list = [];
    for (let j = 0; j < count; j++) {
      const joint = pairs[offset++],
        weight = table[pairs[offset++]];
      if (joint >= 0 && weight > 0) list.push([joint, weight]);
    }
    list.sort((a, b) => b[1] - a[1]);
    const bones = list.slice(0, 4),
      total = bones.reduce((sum, entry) => sum + entry[1], 0);
    assert.ok(total > 0);
    return [
      Array.from({ length: 4 }, (_, i) => bones[i]?.[0] ?? 0),
      Array.from({ length: 4 }, (_, i) => (bones[i]?.[1] ?? 0) / total),
    ];
  });
}

export async function readStag(inputDir, require) {
  const { Document } = require("@gltf-transform/core");
  const { DOMParser } = require("@xmldom/xmldom");
  const folder = path.join(inputDir, "deer-source");
  await mkdir(folder, { recursive: true });
  async function asset(remote) {
    const file = path.join(folder, path.basename(remote));
    try {
      return await readFile(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const response = await fetch(art + remote);
    if (!response.ok) throw Error("Cannot fetch " + remote + " (" + response.status + ")");
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(file, bytes);
    return bytes;
  }
  const xml = async (file) =>
    new DOMParser().parseFromString((await asset(file)).toString(), "application/xml");
  const clips = ["idle", "walk", "run"];
  const [body, antlers, bodyPixels, antlerPixels, ...motions] = await Promise.all([
    xml("meshes/skeletal/deer_mesh.dae"),
    xml("meshes/props/deer_antlers.dae"),
    asset("textures/skins/skeletal/animal_deer_03.png"),
    asset("textures/skins/skeletal/animal_deer_01.png"),
    ...clips.map((name) => xml("animation/quadraped/deer_" + name + "_01.dae")),
  ]);
  const doc = new Document(),
    buffer = doc.createBuffer();
  doc.getRoot().getAsset().copyright = "Wildfire Games, CC BY-SA 3.0";
  const scene = doc.createScene("Stag");
  const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const bones = new Map();
  function makeRig(el, parent) {
    const bone = doc.createNode(el.getAttribute("name")).setMatrix(nodeTransform(el).elements);
    bones.set(el.getAttribute("id"), bone);
    parent.addChild(bone);
    for (const nested of child(el, "node")) makeRig(nested, bone);
  }
  const axis = doc.createNode("Z-up to Y-up").setMatrix(up.elements);
  scene.addChild(axis);
  makeRig(first(first(body, "visual_scene"), "node"), axis);
  const sourceSkin = first(body, "skin");
  const names = first(sourceSkin, "Name_array").textContent.trim().split(/\s+/);
  const rig = doc.createSkin("Stag").setSkeleton(axis);
  for (const name of names) rig.addJoint(bones.get(name));
  const bindSource = all(sourceSkin, "source").find((s) => s.getAttribute("id").endsWith("-bind_poses"));
  const bindFloats = numbers(first(bindSource, "float_array")),
    inverseUp = up.clone().invert();
  const inverses = names.flatMap(
    (name, i) => matrix(bindFloats.slice(i * 16, i * 16 + 16)).multiply(inverseUp).elements,
  );
  rig.setInverseBindMatrices(acc(new Float32Array(inverses), "MAT4"));

  const weights = getWeights(sourceSkin);
  const head = names.indexOf("Deer01_Head-node");
  const stag = doc.createMesh("Stag");
  scene.addChild(doc.createNode("Stag skin").setMesh(stag).setSkin(rig));
  function addPart(source, isAntler) {
    const geometry = first(source, "geometry"),
      tables = all(geometry, "source").map((s) => numbers(first(s, "float_array")));
    const p = numbers(first(first(geometry, "triangles"), "p"));
    const materialName = isAntler ? "Antlers" : "Fawn coat";
    const image = doc
      .createTexture(materialName)
      .setImage(isAntler ? antlerPixels : bodyPixels)
      .setMimeType("image/png");
    const material = doc
      .createMaterial(materialName)
      .setBaseColorTexture(image)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.9);
    if (isAntler) material.setDoubleSided(true).setAlphaMode("MASK").setAlphaCutoff(0.42);
    const bindShape = matrix(numbers(first(sourceSkin, "bind_shape_matrix")));
    // The prop file stores its unscaled symmetrical rack far from its pivot.
    // Seat the two basal tines across the authored socket on the forehead.
    const socket = new Vector3().setFromMatrixPosition(
      new Matrix4().fromArray(bones.get("prop-antler-node").getWorldMatrix()),
    );
    const pos = [],
      normals = [],
      uv = [],
      joints = [],
      influences = [],
      indices = [],
      vertexKeys = new Map();
    for (let i = 0; i < p.length; i += 3) {
      const [vi, ni, ti] = p.slice(i, i + 3),
        key = [vi, ni, ti].join("/");
      if (!vertexKeys.has(key)) {
        vertexKeys.set(key, pos.length / 3);
        const v = new Vector3().fromArray(tables[0], vi * 3);
        if (isAntler) {
          v.sub(new Vector3(4, -2493, 5519))
            .multiplyScalar(0.00056)
            .applyMatrix4(up)
            .add(socket);
        } else v.applyMatrix4(bindShape).applyMatrix4(up);
        pos.push(...v.toArray());
        normals.push(
          ...new Vector3()
            .fromArray(tables[1], ni * 3)
            .transformDirection(up)
            .toArray(),
        );
        uv.push(tables[2][ti * 3], 1 - tables[2][ti * 3 + 1]);
        const [j, w] = isAntler
          ? [
              [head, 0, 0, 0],
              [1, 0, 0, 0],
            ]
          : weights[vi];
        joints.push(...j);
        influences.push(...w);
      }
      indices.push(vertexKeys.get(key));
    }
    stag.addPrimitive(
      doc
        .createPrimitive()
        .setMaterial(material)
        .setAttribute("POSITION", acc(new Float32Array(pos), "VEC3"))
        .setAttribute("NORMAL", acc(new Float32Array(normals), "VEC3"))
        .setAttribute("TEXCOORD_0", acc(new Float32Array(uv), "VEC2"))
        .setAttribute("JOINTS_0", acc(new Uint8Array(joints), "VEC4"))
        .setAttribute("WEIGHTS_0", acc(new Float32Array(influences), "VEC4"))
        .setIndices(acc(new Uint16Array(indices), "SCALAR")),
    );
  }
  addPart(body, false);
  addPart(antlers, true);

  for (const [i, motion] of motions.entries()) {
    const animation = doc.createAnimation(clips[i]);
    for (const track of all(motion, "animation")) {
      const channel = first(track, "channel");
      const bone = bones.get(channel.getAttribute("target").split("/")[0]);
      if (!bone) continue;
      const sources = child(track, "source");
      const frames = sources.find((s) => s.getAttribute("id").endsWith("-output"));
      const times = acc(
        new Float32Array(
          numbers(
            first(
              sources.find((s) => s.getAttribute("id").endsWith("-input")),
              "float_array",
            ),
          ),
        ),
        "SCALAR",
      );
      const matrices = numbers(first(frames, "float_array"));
      const tracks = { translation: [], rotation: [], scale: [] };
      let previous;
      for (let f = 0; f < matrices.length; f += 16) {
        const v = new Vector3(),
          q = new Quaternion(),
          scale = new Vector3();
        matrix(matrices.slice(f, f + 16)).decompose(v, q, scale);
        q.normalize();
        if (previous && previous.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        previous = q;
        tracks.translation.push(...v.toArray());
        tracks.rotation.push(...q.toArray());
        tracks.scale.push(...scale.toArray());
      }
      for (const [target, values] of Object.entries(tracks)) {
        const sampler = doc
          .createAnimationSampler()
          .setInput(times)
          .setOutput(acc(new Float32Array(values), target === "rotation" ? "VEC4" : "VEC3"));
        animation
          .addSampler(sampler)
          .addChannel(
            doc.createAnimationChannel().setTargetNode(bone).setTargetPath(target).setSampler(sampler),
          );
      }
    }
  }
  return doc;
}
