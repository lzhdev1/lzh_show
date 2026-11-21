import * as THREE from "three";
import type { Spirit } from "../../game/weather";
import { complexions, paintDollAtlas } from "./facePaint";
import type { DollAdd } from "./geometry";

// Horizontal sections of the sculpt, from the forward-set chin to the crown.
// Each entry records height, half-width, front depth, back depth and centre.
type Section = [number, number, number, number, number];
const silhouette: Section[] = [
  [.690, .002, .002, .002, .082],
  [.700, .060, .055, .042, .073],
  [.724, .106, .091, .076, .063],
  [.755, .150, .129, .110, .047],
  [.790, .188, .162, .145, .027],
  [.824, .216, .181, .169, .017],
  [.862, .239, .190, .186, .007],
  [.908, .252, .196, .199, .001],
  [.960, .255, .197, .210, 0],
  [1.012, .249, .197, .210, -.002],
  [1.065, .239, .188, .200, -.004],
  [1.111, .211, .168, .184, -.007],
  [1.151, .162, .125, .141, -.010],
  [1.180, .100, .078, .090, -.010],
  [1.200, .002, .002, .002, -.008],
];

function sectionAt(i: number, t: number): Section {
  const previous = silhouette[Math.max(i - 1, 0)], a = silhouette[i], b = silhouette[i + 1];
  const next = silhouette[Math.min(i + 2, silhouette.length - 1)], h = b[0] - a[0];
  const t2 = t * t, t3 = t2 * t;
  const result: Section = [a[0] + h * t, 0, 0, 0, 0];
  for (let k = 1; k < 5; k++) {
    const tangentA = (b[k] - previous[k]) / (b[0] - previous[0]);
    const tangentB = (next[k] - a[k]) / (next[0] - a[0]);
    result[k] = (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * h * tangentA
      + (3 * t2 - 2 * t3) * b[k] + (t3 - t2) * h * tangentB;
  }
  return result;
}

function bell(x: number, y: number, width: number, height: number) {
  return Math.exp(-((x / width) ** 2 + (y / height) ** 2));
}

function skull(id: Spirit) {
  const sections: Section[] = [];
  for (let i = 0; i < silhouette.length - 1; i++) {
    const height = silhouette[i][0];
    const spacing = height >= .824 && height < .908 ? .009 : .016;
    const steps = Math.ceil((silhouette[i + 1][0] - height) / spacing);
    for (let j = 0; j < steps; j++) sections.push(sectionAt(i, j / steps));
  }
  sections.push(silhouette[silhouette.length - 1]);

  const frontSegments = 40, backQuadrant = 7, segments = frontSegments + backQuadrant * 2;
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  const boy = id === "nocturne" || id === "orbit" || id === "bamboo";
  for (const [y, width, front, back, center] of sections) {
    for (let j = 0; j <= segments; j++) {
      let angle: number, u: number;
      if (j < backQuadrant) {
        const t = j / backQuadrant;
        angle = (t / 2 - 1) * Math.PI;
        u = .025 + t * .0375;
      } else if (j <= backQuadrant + frontSegments) {
        const t = 2 * (j - backQuadrant) / frontSegments - 1;
        // Closer meridians around the nose resolve its ridge in profile.
        angle = (t * .55 + t ** 3 * .45) * Math.PI / 2;
        u = .5 + .4375 * Math.sin(angle);
      } else {
        const t = (j - backQuadrant - frontSegments) / backQuadrant;
        angle = (.5 + t / 2) * Math.PI;
        u = .9375 + t * .0375;
      }
      const c = Math.cos(angle);
      const jaw = boy ? .006 * Math.exp(-(((y - .79) / .046) ** 2)) : 0;
      const x = (width + jaw) * Math.sin(angle);
      let z = center + (c > 0 ? front * c ** .80 : -back * (-c) ** .97);
      if (c > 0) {
        const side = Math.abs(x);
        // Nose tip, bridge and wings flow into a shallow socket and rounded
        // malar cheek. The light catches the same features at every angle.
        const relief = .018 * bell(x, y - .859, .026, .021)
          + .016 * bell(x, y - .886, .018, .046)
          + .005 * bell(side - .019, y - .854, .011, .009)
          - .007 * bell(side - .102, y - .932, .053, .037)
          + .010 * bell(side - .140, y - .868, .064, .045)
          + .004 * bell(x, y - .805, .039, .018)
          + .004 * bell(x, y - .753, .055, .025);
        z += relief * c;
      }
      pos.push(x, y, z);
      uv.push(u, .245 + .735 * (y - .69) / .51);
    }
  }
  const stride = segments + 1;
  for (let row = 0; row < sections.length - 1; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * stride + col, b = a + stride;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const last = stride * (sections.length - 1);
  for (let j = 1; j < segments - 1; j++) {
    indices.push(0, j + 1, j, last, last + j, last + j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Pull the central face normals toward a slightly raised porcelain plane.
  // This keeps the painted skin warm under the farm's green ground bounce,
  // with the original geometry normals intact at the profile and hairline.
  const normals = geo.getAttribute("normal");
  const normal = new THREE.Vector3();
  for (let row = 0; row < sections.length; row++) {
    const height = sections[row][0];
    for (let col = backQuadrant + 1; col < backQuadrant + frontSegments; col++) {
      const index = row * stride + col;
      const front = Math.max(0, 1 - ((uv[index * 2] - .5) / .4375) ** 2);
      const influence = front * (1 - THREE.MathUtils.smoothstep(height, 1.04, 1.13));
      normal.fromBufferAttribute(normals, index);
      normal.y = THREE.MathUtils.lerp(normal.y, normal.y * .43 + .16, influence);
      normal.z += .16 * influence;
      normal.normalize();
      normals.setXYZ(index, normal.x, normal.y, normal.z);
    }
  }
  geo.userData.dollAtlas = true;
  return geo;
}

// The ear is a shallow carved shell. A raised helix circles the bowl and
// disappears into the earlobe; the back closes into the side of the skull.
function ear(id: Spirit, side: number) {
  const skin = new THREE.Color(complexions[id]);
  const concha = new THREE.Color("#c58475"), colour = new THREE.Color();
  const rings = [[.04, .003, .52], [.35, .007, .50], [.54, .008, .34],
    [.75, .016, .08], [1, .006, 0], [.76, -.010, .05], [.04, -.012, .04]];
  const pos: number[] = [], rgb: number[] = [], indices: number[] = [];
  const count = 20;
  for (const [r, depth, blush] of rings) {
    for (let j = 0; j < count; j++) {
      const angle = j / count * 2 * Math.PI, s = Math.sin(angle);
      const width = .029 * r * Math.cos(angle) * (.89 + .17 * s) - .006 * r * s;
      const relief = depth * (.89 + .11 * s);
      pos.push(side * (.240 + .42 * width + .91 * relief), .885 + .043 * r * s, -.004 - .91 * width + .42 * relief);
      colour.copy(skin).lerp(concha, blush);
      rgb.push(colour.r, colour.g, colour.b);
    }
  }
  function triangle(a: number, b: number, c: number) {
    if (side === 1) indices.push(a, b, c);
    else indices.push(a, c, b);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < count; j++) {
      const a = i * count + j, b = i * count + (j + 1) % count;
      triangle(a, a + count, b);
      triangle(b, a + count, b + count);
    }
  }
  const last = (rings.length - 1) * count;
  for (let j = 1; j < count - 1; j++) {
    triangle(0, j, j + 1);
    triangle(last, last + j + 1, last + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function addDollFace(id: Spirit, add: DollAdd) {
  add(skull(id), 0xffffff);
  add(ear(id, 1), 0xffffff);
  add(ear(id, -1), 0xffffff);
}

export function createDollAtlas(id: Spirit): THREE.Texture {
  const map = new THREE.CanvasTexture(paintDollAtlas(id));
  map.name = `Doll paint · ${id}`;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 2;
  return map;
}
