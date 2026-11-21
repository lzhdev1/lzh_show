// Derive an adult giant panda on the 0 A.D. brown bear's original rig and UVs.
import { Matrix3, Vector3 } from "three";

function smooth(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Deform the bind mesh before subdivision. All duplicate UV vertices see the
// same spatial warp; the walk rig and its paw contact points stay in place.
function pandaShape(x, y, z) {
  const front = smooth(0.54, 0.82, z) * smooth(0.48, 0.69, y);
  const ear =
    smooth(0.005, 0.087, y + 0.52 * (Math.abs(x) - 0.14) - 1.01) *
    (1 - smooth(0.025, 0.055, Math.abs(z - 0.853))) *
    smooth(0.06, 0.085, Math.abs(x)) *
    (1 - smooth(0.188, 0.211, Math.abs(x)));
  const torso = smooth(0.15, 0.57, y) * (1 - smooth(0.48, 0.76, z));
  const cheek = front * (1 - smooth(0.99, 1.19, z));
  const belly = torso * (1 - smooth(0.55, 0.93, y)) * smooth(-0.85, -0.59, z);
  return new Vector3(
    x * (1 + 0.22 * torso + 0.34 * front + 0.2 * cheek) +
      Math.sign(x) * (0.035 + 1.05 * (Math.abs(x) - 0.137)) * ear,
    y -
      0.085 * belly +
      front * (0.095 + (y - 0.89) * 0.25) +
      ear * (0.028 + (y - 1.018) * 0.38) +
      torso * 0.018,
    z + front * (0.018 - 0.49 * Math.max(0, z - 0.89)) + (0.014 + (z - 0.844) * 0.95) * ear - 0.028 * torso,
  );
}

function remodel(primitive) {
  const positions = primitive.getAttribute("POSITION"),
    normals = primitive.getAttribute("NORMAL");
  const p = [],
    n = [],
    h = 0.00012;
  for (let i = 0; i < positions.getCount(); i++) {
    const [x, y, z] = positions.getElement(i, p);
    const px = pandaShape(x + h, y, z).sub(pandaShape(x - h, y, z));
    const py = pandaShape(x, y + h, z).sub(pandaShape(x, y - h, z));
    const pz = pandaShape(x, y, z + h).sub(pandaShape(x, y, z - h));
    const normalMatrix = new Matrix3()
      .set(px.x, py.x, pz.x, px.y, py.y, pz.y, px.z, py.z, pz.z)
      .invert()
      .transpose();
    const normal = new Vector3().fromArray(normals.getElement(i, n)).applyMatrix3(normalMatrix).normalize();
    positions.setElement(i, pandaShape(x, y, z).toArray());
    normals.setElement(i, normal.toArray());
  }
}

function coat({ x, y, z, ear, u, v }, rgb) {
  const luma = 0.25 * rgb[0] + 0.6 * rgb[1] + 0.15 * rgb[2];
  const fiber = (luma - 91) / 255;
  const side = smooth(0.12, 0.33, Math.abs(x));
  // The shoulder girdle crosses the withers and flows into both forelegs.
  const shoulderBack = 0.077 + 0.045 * (y - 0.72) - 0.105 * (1 - smooth(0.56, 1.07, y));
  const shoulderFront = 0.51 + 0.058 * side + 0.046 * (1 - smooth(0.62, 0.98, y));
  const shoulder =
    smooth(shoulderBack - 0.034, shoulderBack + 0.023, z + fiber * 0.055) *
    (1 - smooth(shoulderFront - 0.025, shoulderFront + 0.044, z - fiber * 0.056));
  const haunchTop = 0.52 + 0.29 * side + 0.044 * Math.cos((z + 0.6) * 5);
  const hind =
    (1 - smooth(-0.32, -0.2, z)) * (1 - smooth(haunchTop - 0.034, haunchTop + 0.035, y - fiber * 0.068));
  const legs = (1 - smooth(0.38, 0.51, y)) * smooth(0.015, 0.16, Math.abs(z));
  const earZone = smooth(0.79, 0.829, z) * (1 - smooth(0.862, 0.891, z)) * smooth(0.068, 0.094, Math.abs(x));
  const ears = Math.max(
    earZone * smooth(0.16, 0.64, ear) * smooth(1.005, 1.031, y),
    u > 450 && v < 45 ? 1 : 0,
  );
  const face = z > 0.78 && y > 0.63 && u > 326 && v > 290;
  let eye = 0,
    nose = 0,
    lip = 0;
  if (face) {
    // Both sides of the authored face share this UV island. Follow the eye's
    // existing diagonal crease towards the cheek, keeping the real iris.
    const du = u - 403,
      dv = v - 366;
    const along = 0.425 * du + 0.905 * dv,
      across = -0.905 * du + 0.425 * dv;
    const radius = Math.hypot(along / 24.8, across / (10.8 + 4.5 * smooth(-17, 12, along)));
    eye = 1 - smooth(0.88, 1.06, radius - fiber * 0.19);
    nose = (1 - smooth(350.8, 357.7, u)) * (1 - smooth(12, 18, Math.abs(v - 391)));
    lip =
      smooth(0.92, 1.04, z) *
      (1 - smooth(2.1, 4.5, Math.abs(v - (419.8 - 0.16 * (u - 352))))) *
      (1 - smooth(372, 393, u));
  }
  const dark = Math.max(shoulder, hind, legs, ears, eye, nose, lip);
  const shade = 169 + 0.38 * luma;
  const ink = 9 + 0.31 * luma + ears * (6 + 0.055 * luma);
  const warm = [shade + 7, shade + 6, shade + 3];
  const cool = [ink * 0.92, ink, ink * 1.075 + 1];
  const color = warm.map((v, i) => v + (cool[i] - v) * dark);
  if (face) {
    const dist = Math.hypot((u - 399.4) / 4.8, (v - 357.4) / 3.5);
    const iris = 1 - smooth(0.7, 1.15, dist);
    const glint = 1 - smooth(0.2, 1.05, Math.hypot((u - 398.6) / 1.05, (v - 356.1) / 0.88));
    for (let i = 0; i < 3; i++) {
      color[i] += iris * (rgb[i] * (i === 2 ? 1.14 : 1.04) - color[i]);
      color[i] += glint * (246 - color[i]) * 0.9;
      if (nose > 0) color[i] += nose * 0.25 * (luma * 0.81 - color[i]);
    }
  }
  // The mouth interior is a separate island in the upper-left of the skin.
  return u < 23 && v > 13 && v < 78 ? rgb : color;
}

async function repaint(doc, primitive, sharp) {
  const texture = primitive.getMaterial().getBaseColorTexture();
  const {
    data: src,
    info: { width, height },
  } = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const dst = Buffer.from(src),
    covered = new Uint8Array(width * height);
  const indices = primitive.getIndices().getArray(),
    pos = primitive.getAttribute("POSITION");
  const uv = primitive.getAttribute("TEXCOORD_0"),
    joints = primitive.getAttribute("JOINTS_0"),
    weights = primitive.getAttribute("WEIGHTS_0");
  const names = doc
    .getRoot()
    .listSkins()[0]
    .listJoints()
    .map((n) => n.getName());
  const vertices = Array.from({ length: pos.getCount() }, (_, i) => {
    const [x, y, z] = pos.getElement(i, []),
      [s, t] = uv.getElement(i, []),
      w = weights.getElement(i, []);
    const ear = joints
      .getElement(i, [])
      .reduce((sum, id, k) => sum + (names[id].includes("_ear_") ? w[k] : 0), 0);
    return { x, y, z, ear, u: s * width, v: t * height };
  });
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [vertices[indices[k]], vertices[indices[k + 1]], vertices[indices[k + 2]]];
    const det = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
    if (Math.abs(det) < 1e-8) continue;
    const minX = Math.max(0, Math.floor(Math.min(a.u, b.u, c.u))),
      maxX = Math.min(width - 1, Math.ceil(Math.max(a.u, b.u, c.u)));
    const minY = Math.max(0, Math.floor(Math.min(a.v, b.v, c.v))),
      maxY = Math.min(height - 1, Math.ceil(Math.max(a.v, b.v, c.v)));
    for (let ty = minY; ty <= maxY; ty++)
      for (let tx = minX; tx <= maxX; tx++) {
        const u = tx + 0.5,
          v = ty + 0.5;
        const wa = ((b.v - c.v) * (u - c.u) + (c.u - b.u) * (v - c.v)) / det;
        const wb = ((c.v - a.v) * (u - c.u) + (a.u - c.u) * (v - c.v)) / det,
          wc = 1 - wa - wb;
        if (Math.min(wa, wb, wc) < -1e-5) continue;
        const mix = (key) => wa * a[key] + wb * b[key] + wc * c[key];
        const index = ty * width + tx,
          i = 4 * index;
        const rgb = coat(
          {
            x: mix("x"),
            y: mix("y"),
            z: mix("z"),
            ear: mix("ear"),
            u: (u * 512) / width,
            v: (v * 512) / height,
          },
          src.subarray(i, i + 3),
        );
        for (let channel = 0; channel < 3; channel++)
          dst[i + channel] = Math.round(Math.min(255, Math.max(0, rgb[channel])));
        covered[index] = 1;
      }
  }
  // Extrude islands so linear filtering and lower mip levels sample panda fur.
  for (let pass = 0; pass < 6; pass++) {
    const next = covered.slice();
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const j = y * width + x;
        if (covered[j]) continue;
        const donor = [j - 1, j + 1, j - width, j + width].find((i) => covered[i]);
        if (donor === undefined) continue;
        dst.copy(dst, j * 4, donor * 4, donor * 4 + 3);
        next[j] = 1;
      }
    covered.set(next);
  }
  texture
    .setName("Adult giant panda fur")
    .setMimeType("image/png")
    .setImage(
      await sharp(dst, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer(),
    );
}

export async function derivePanda(doc, sharp) {
  const mesh = doc.getRoot().listMeshes()[0],
    primitive = mesh.listPrimitives()[0];
  mesh.setName("Adult giant panda");
  primitive.getMaterial().setName("Panda winter coat");
  await repaint(doc, primitive, sharp);
  remodel(primitive);
  doc.getRoot().getAsset().copyright = "Adapted from Wildfire Games, CC BY-SA 3.0";
}
