import * as THREE from "three";
import { DEFAULT_DECOR, type DecorStyle, type FarmDecor } from "../game/decor";
import { FARM_SIGN, FENCE_X, FENCE_Z, GATE_HALF } from "./layout";
import { WorldObstacles } from "./obstacles";
import { bakeScenery } from "./scenery";
import { clay } from "./materials";

const palettes = {
  orchard: { wood: 0x806149, rail: 0xc6a681, trim: 0xf0d7a5, paint: 0x66856b, metal: 0x506b54, lamp: 0xe9ff95 },
  lantern: { wood: 0x813c37, rail: 0xa94a3d, trim: 0xe7b262, paint: 0x556a69, metal: 0x654c47, lamp: 0xffb44e },
  moon: { wood: 0x46556f, rail: 0x768ba5, trim: 0xc6c9b2, paint: 0x5a6f96, metal: 0x374962, lamp: 0x9ceaff },
} as const;

function part(g: THREE.Group, geometry: THREE.BufferGeometry, c: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, clay(c));
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}
function box(g: THREE.Group, c: number, x: number, y: number, z: number, w: number, h: number, d: number) {
  return part(g, new THREE.BoxGeometry(w, h, d), c, x, y, z);
}
function post(g: THREE.Group, c: number, x: number, y: number, z: number,
              top: number, bottom: number, h: number, sides = 8) {
  return part(g, new THREE.CylinderGeometry(top, bottom, h, sides), c, x, y, z);
}
function gem(g: THREE.Group, c: number, x: number, y: number, z: number, r: number) {
  return part(g, new THREE.OctahedronGeometry(r), c, x, y, z);
}
function blossom(g: THREE.Group, x: number, y: number, z: number, scale: number) {
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const leaf = part(g, new THREE.IcosahedronGeometry(.10 * scale), 0xf4d4bc,
      x + .075 * scale * Math.cos(a), y + .075 * scale * Math.sin(a), z);
    leaf.scale.z = .55;
  }
  gem(g, 0xf3c96d, x, y, z + .045 * scale, .07 * scale);
}
function lantern(g: THREE.Group, x: number, y: number, z: number, scale: number) {
  const lamp = new THREE.Group();
  lamp.position.set(x, y, z);
  lamp.scale.setScalar(scale);
  g.add(lamp);
  const globe = part(lamp, new THREE.SphereGeometry(.23, 12, 7), 0xfda657, 0, 0, 0);
  globe.scale.set(1, 1.22, 1);
  for (const sign of [-1, 1]) {
    post(lamp, 0x804b40, 0, sign * .22, 0, .15, .15, .07);
    post(lamp, 0xd89b53, 0, sign * .12, 0, .217, .217, .015, 12);
  }
  post(lamp, 0xb44938, 0, -.33, 0, .018, .038, .19);
}

interface Light { x: number; y: number; z: number; radius: number }
const clock = () => ({ value: 0 });

// Batch the camera-facing halos, without adding dynamic lights or screen-space bloom.
function glow(lights: Light[], style: DecorStyle, time: ReturnType<typeof clock>) {
  const centers: number[] = [], uv: number[] = [], radii: number[] = [], indices: number[] = [];
  for (const light of lights) {
    const base = radii.length;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      centers.push(light.x, light.y, light.z);
      uv.push(u, v);
      radii.push(light.radius);
    }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(centers, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("radius", new THREE.Float32BufferAttribute(radii, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += 1;
  const material = new THREE.ShaderMaterial({
    uniforms: { t: time, tint: { value: new THREE.Color(palettes[style].lamp) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float radius; varying vec2 disc; varying float seed;
      void main() { disc = uv*2.-1.; seed = dot(position,vec3(.73,1.9,.39));
        vec4 p = modelViewMatrix * vec4(position,1.);
        p.xy += disc * radius; gl_Position = projectionMatrix*p; }`,
    fragmentShader: `uniform vec3 tint; uniform float t; varying vec2 disc; varying float seed;
      void main() { float r = dot(disc,disc);
        float halo = exp(-5.8*r) * (1.-smoothstep(.64,1.,r));
        float flare = .16*exp(-12.*abs(disc.x)-3.*abs(disc.y)) + .12*exp(-4.*abs(disc.x)-13.*abs(disc.y));
        gl_FragColor=vec4(tint,(halo*.85+flare)*(.88+.12*sin(t*1.55+seed)));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}

type Span = { x: number; z: number; length: number; yaw: number };
const spans: Span[] = [];
for (const side of [-1, 1]) {
  spans.push({ x: side * FENCE_X, z: 0, length: 2 * FENCE_Z, yaw: Math.PI / 2 });
  for (const sideX of [-1, 1]) {
    spans.push({ x: sideX * (FENCE_X + GATE_HALF) / 2, z: side * FENCE_Z,
      length: FENCE_X - GATE_HALF, yaw: 0 });
  }
}

function fencePanel(style: DecorStyle) {
  const g = new THREE.Group();
  const { rail, trim, wood, paint, metal, lamp } = palettes[style];
  for (const x of [-1, 1]) {
    const width = style === "moon" ? .19 : .13;
    box(g, wood, x, .48, 0, width, .96, width);
    box(g, trim, x, .89, 0, width + .06, .055, width + .06);
    const crown = gem(g, style === "lantern" ? lamp : paint, x, 1.02, 0, .13);
    crown.scale.y = style === "moon" ? 1.72 : .8;
  }
  for (const height of [.29, .73]) box(g, rail, 0, height, 0, 2, .09, .095);
  if (style === "orchard") {
    for (const x of [-.69, -.34, 0, .34, .69]) {
      const h = .60 + .20 * Math.abs(x);
      box(g, trim, x, h / 2 + .09, .045, .155, h, .08);
      const tip = post(g, trim, x, h + .15, .045, 0, .11, .13, 4);
      tip.rotation.y = Math.PI / 4;
      tip.scale.z = .52;
    }
  } else if (style === "lantern") {
    for (const x of [-.46, .46]) {
      for (const sign of [-1, 1]) {
        box(g, trim, x, .50, .055, .06, .59, .065).rotation.z = sign * .69;
      }
    }
    lantern(g, 0, .65, .15, .58);
  } else {
    for (const x of [-.59, 0, .59]) {
      const wire = part(g, new THREE.TorusGeometry(.247, .027, 5, 4), trim, x, .53, .015);
      wire.scale.y = 1.16;
      gem(g, x === 0 ? lamp : metal, x, .53, .015, .077);
    }
  }
  return bakeScenery(g);
}
function fence(style: DecorStyle, time: ReturnType<typeof clock>) {
  const group = new THREE.Group(), template = fencePanel(style);
  const placements: THREE.Matrix4[] = [], lights: Light[] = [];
  const panel = new THREE.Object3D();
  for (const span of spans) {
    const n = Math.round(span.length / 2), pitch = span.length / n;
    for (let i = 0; i < n; i++) {
      const u = (i + .5) * pitch - span.length / 2;
      panel.position.set(span.x + Math.cos(span.yaw) * u, 0, span.z - Math.sin(span.yaw) * u);
      panel.rotation.y = span.yaw;
      panel.scale.x = pitch / 2;
      panel.updateMatrix();
      placements.push(panel.matrix.clone());
      if (style === "orchard" && i % 2 === 0) continue;
      const center = style === "lantern" ? new THREE.Vector3(0, .65, .18)
        : new THREE.Vector3(style === "moon" ? 0 : -1, style === "moon" ? .53 : 1.10, .025);
      center.applyMatrix4(panel.matrix);
      lights.push({ x: center.x, y: center.y, z: center.z, radius: style === "lantern" ? .44 : .31 });
    }
  }
  const mesh = new THREE.InstancedMesh(template.geometry, template.material, placements.length);
  placements.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.computeBoundingSphere();
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh, glow(lights, style, time));
  return group;
}

function crescent(g: THREE.Group, x: number, y: number, z: number, radius: number) {
  const shape = new THREE.Shape();
  shape.moveTo(.54 * radius, .85 * radius);
  shape.bezierCurveTo(-1.26*radius, 1.08*radius, -1.17*radius, -1.12*radius, .55*radius, -.73*radius);
  shape.bezierCurveTo(-.47*radius, -.49*radius, -.48*radius, .41*radius, .54*radius, .85*radius);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelThickness: .015, bevelSize: .012, bevelSegments: 1, curveSegments: 10 });
  part(g, geometry, 0xf5d8a1, x, y, z);
}

function gate(style: DecorStyle, time: ReturnType<typeof clock>) {
  const structure = new THREE.Group(), lights: Light[] = [];
  const { wood, rail, trim, paint, metal, lamp } = palettes[style];
  for (const end of [-1, 1]) {
    const z = end * FENCE_Z, h = end < 0 ? 2.55 : 2.88;
    for (const sign of [-1, 1]) {
      const x = sign * GATE_HALF;
      box(structure, wood, x, h / 2, z, .24, h, .24);
      box(structure, metal, x, .20, z, .40, .40, .40);
      box(structure, trim, x, .43, z, .32, .075, .32);
      box(structure, trim, x, h - .22, z, .41, .12, .34);
      box(structure, rail, x - sign * .19, h - .36, z, .11, .80, .13).rotation.z = -sign * .61;
    }
    if (style === "orchard") {
      for (const side of [-1, 1]) box(structure, rail, 0, h, z + side * .24, 5.20, .15, .13);
      for (let i = -4; i <= 4; i++) box(structure, trim, i * .55, h + .11, z, .12, .10, .94);
      for (let i = 0; i < 18; i++) {
        const x = i < 13 ? -2.39 + i * .27 : -2.20 + .05 * Math.sin(i);
        const y = h + (i < 13 ? .14 + .08 * Math.cos(i) : .13 - (i - 12) * .17);
        const leaf = part(structure, new THREE.IcosahedronGeometry(.16), i % 3 ? paint : 0x819e64, x, y, z + .23);
        leaf.scale.set(1.47, .65, .82);
        leaf.rotation.z = .36 * Math.sin(i);
        if (i % 4 === 0) {
          blossom(structure, x, y - .045, z + .39, .77);
          lights.push({ x, y: y - .05, z: z + .46, radius: .30 });
        }
      }
    } else if (style === "lantern") {
      box(structure, rail, 0, h - .02, z, 5.15, .20, .43);
      for (let i = -5; i <= 5; i++) {
        const rise = .18 * (i / 5) ** 2;
        const tile = box(structure, paint, i * .485, h + .16 + rise, z, .51, .15, .73);
        tile.rotation.z = .034 * i;
        box(structure, trim, i * .485, h + .10 + rise, z + .37, .49, .035, .045).rotation.z = tile.rotation.z;
      }
      for (const side of [-1, 1]) {
        const x = side * 1.58;
        post(structure, metal, x, h - .135, z, .02, .02, .24);
        lantern(structure, x, h - .62, z, 1.35);
        lights.push({ x, y: h - .62, z, radius: .87 });
      }
      gem(structure, trim, 0, h + .36, z, .17);
    } else {
      for (const side of [-1, 1]) {
        const lean = -side * .219;
        box(structure, wood, side * 1.13, h + .20, z, 2.42, .19, .32).rotation.z = lean;
        box(structure, trim, side * 1.13, h + .31, z, 2.45, .055, .37).rotation.z = lean;
        for (let i = 0; i < 3; i++) {
          const x = side * (.62 + i * .58), base = h + .40 - Math.abs(x) * .21;
          post(structure, trim, x, base - .15, z + .07, .017, .017, .25);
          const crystal = gem(structure, lamp, x, base - .38, z + .07, .095);
          crystal.scale.y = 1.75;
          lights.push({ x, y: base - .37, z: z + .09, radius: .32 });
        }
      }
      crescent(structure, 0, h + .69, z - .04, .39);
      gem(structure, lamp, .15, h + .72, z + .03, .094);
      lights.push({ x: .15, y: h + .72, z: z + .04, radius: .52 });
    }
  }
  const group = new THREE.Group();
  group.add(bakeScenery(structure), glow(lights, style, time));
  return group;
}

function signFrame(style: DecorStyle, time: ReturnType<typeof clock>) {
  const g = new THREE.Group(), lights: Light[] = [];
  const { wood, trim, paint, metal, lamp } = palettes[style];
  for (const x of [-1.12, 1.12]) {
    box(g, wood, x, .98, 0, .14, 1.96, .16);
    post(g, metal, x, .12, 0, .12, .16, .24);
    box(g, trim, x, .80, 0, .20, .075, .20);
  }
  box(g, paint, 0, 1.43, 0, 2.7, 1.14, .15);
  for (const y of [.88, 1.99]) box(g, trim, 0, y, 0, 2.78, .075, .21);
  for (const sign of [-1, 1]) {
    box(g, trim, sign * 1.33, 1.44, 0, .07, 1.14, .21);
    if (style === "orchard") {
      for (let i = 0; i < 4; i++) {
        const x = sign * (1.18 - .13 * i), y = 2.02 + Math.sin(i * .9) * .08;
        const leaf = gem(g, i % 2 ? 0x719771 : 0x9eb679, x, y, .11, .14);
        leaf.scale.set(1.35, .68, .68); leaf.rotation.z = sign * .48;
      }
      blossom(g, sign * 1.12, 2.05, .17, .71);
      lights.push({ x: sign * 1.12, y: 2.05, z: .21, radius: .32 });
    } else if (style === "lantern") {
      const x = sign * 1.49;
      box(g, wood, sign * .75, 2.14, 0, 1.64, .13, .45).rotation.z = sign * .085;
      lantern(g, x, 1.82, 0, .75);
      lights.push({ x, y: 1.82, z: 0, radius: .43 });
    } else {
      const frame = box(g, trim, sign * .69, 2.08, 0, 1.44, .08, .18);
      frame.rotation.z = -sign * .14;
      gem(g, lamp, sign * 1.33, 1.96, .13, .104).scale.y = 1.5;
      lights.push({ x: sign * 1.33, y: 1.96, z: .14, radius: .38 });
    }
  }
  if (style === "moon") crescent(g, 0, 2.24, -.04, .18);
  const result = new THREE.Group();
  result.add(bakeScenery(g), glow(lights, style, time));
  result.position.set(FARM_SIGN.x, 0, FARM_SIGN.z);
  result.rotation.y = FARM_SIGN.yaw;
  return result;
}

function lettering(style: DecorStyle, text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  const ink = { orchard: "#ffecc0", lantern: "#ffe18a", moon: "#dcf6ff" }[style];
  const rim = { orchard: "#304f39", lantern: "#793622", moon: "#293657" }[style];
  const face = style === "lantern" ? '"KaiTi","STKaiti",serif' :
    style === "moon" ? '"Songti SC","SimSun",serif' : '"Microsoft YaHei","PingFang SC",sans-serif';
  let size = 161;
  ctx.font = `bold ${size}px ${face}`;
  size = Math.min(size, Math.floor(size * 920 / Math.max(ctx.measureText(text).width, 1)));
  ctx.font = `bold ${size}px ${face}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.shadowColor = ink; ctx.shadowBlur = 13;
  ctx.strokeStyle = rim; ctx.lineWidth = Math.max(5, size * .11);
  ctx.strokeText(text, 512, 194);
  ctx.shadowBlur = 0; ctx.fillStyle = ink;
  ctx.fillText(text, 512, 194);
  // A different printer's ornament accompanies each type style on both faces.
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 2.8;
  for (const y of [49, 335]) {
    ctx.fillRect(361, y - 1.5, 116, 3); ctx.fillRect(547, y - 1.5, 116, 3);
    for (const x of [490, 512, 534]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      const s = x === 512 ? 12 : 6;
      if (style === "orchard") {
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * .47, 0, 0, Math.PI * 2); ctx.fill();
      } else if (style === "lantern") ctx.strokeRect(-s / 2, -s / 2, s, s);
      else ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  const group = new THREE.Group(), geometry = new THREE.PlaneGeometry(2.57, .99);
  for (const side of [-1, 1]) {
    const faceMesh = new THREE.Mesh(geometry, mat);
    faceMesh.position.set(0, 1.43, side * .079);
    faceMesh.rotation.y = side < 0 ? Math.PI : 0;
    group.add(faceMesh);
  }
  group.position.set(FARM_SIGN.x, 0, FARM_SIGN.z);
  group.rotation.y = FARM_SIGN.yaw;
  return group;
}

function release(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node instanceof THREE.InstancedMesh) node.dispose();
    geometries.add(node.geometry);
    // Baked vertex-colour materials are shared with the world's other static props.
    if (node.material instanceof THREE.ShaderMaterial || node.material instanceof THREE.MeshBasicMaterial) materials.add(node.material);
  });
  for (const geo of geometries) geo.dispose();
  for (const material of materials) {
    if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
    material.dispose();
  }
  group.removeFromParent();
}

export function createFarmDecor(obstacles: WorldObstacles, initial = DEFAULT_DECOR) {
  for (const span of spans) obstacles.addBox(span.x, span.z, span.length / 2, .14, span.yaw);
  for (const x of [-GATE_HALF, GATE_HALF]) for (const z of [-FENCE_Z, FENCE_Z]) obstacles.addBox(x, z, .20, .20);
  obstacles.addBox(FARM_SIGN.x, FARM_SIGN.z, 1.39, .10, FARM_SIGN.yaw);
  const group = new THREE.Group(), time = clock();
  const parts: Partial<Record<"fence" | "gate" | "sign" | "lettering", THREE.Group>> = {};
  let previous: FarmDecor | undefined;
  function replace(key: keyof typeof parts, value: THREE.Group) {
    if (parts[key]) release(parts[key]!);
    value.name = "farm-" + key;
    parts[key] = value;
    group.add(value);
  }
  function setDecor(d: FarmDecor) {
    if (d.fence !== previous?.fence) replace("fence", fence(d.fence, time));
    if (d.gate !== previous?.gate) replace("gate", gate(d.gate, time));
    if (d.sign !== previous?.sign) replace("sign", signFrame(d.sign, time));
    if (d.lettering !== previous?.lettering || d.text !== previous?.text) replace("lettering", lettering(d.lettering, d.text));
    previous = { ...d };
  }
  setDecor(initial);
  return { group, setDecor, update: (t: number) => { time.value = t; } };
}
