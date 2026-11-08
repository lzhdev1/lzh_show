import * as THREE from "three";

const WOOD = 0xa97b4f;
const WOOD_DARK = 0x8a5f3c;
const FENCE_X = 6.2;
const FENCE_Z = 7.8;

function createGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#86b862";
  ctx.fillRect(0, 0, size, size);
  const tones = ["#7cad57", "#8fbe68", "#79a753", "#93c26c"];
  for (let i = 0; i < 180; i += 1) {
    ctx.globalAlpha = 0.22 + Math.random() * 0.32;
    ctx.fillStyle = tones[i % tones.length];
    const r = 5 + Math.random() * 18;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      r,
      r * 0.7,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = i % 2 ? "#5f8f45" : "#a6d47e";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 4);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(27, 27);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fbf3e0";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "#6ba84c";
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, 484, 228);
  ctx.fillStyle = "#3f6b33";
  ctx.font = 'bold 92px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TT农场", 256, 118);
  ctx.fillStyle = "#8a9a6b";
  ctx.font = 'bold 28px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("T T F A R M", 256, 196);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function mat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: true,
  });
}

/** 围栏：立柱 + 横杆，用实例化把十几根杆压成两个 draw call */
function buildFence(): THREE.Group {
  const group = new THREE.Group();
  const postPositions: Array<{ x: number; z: number }> = [];
  const rails: Array<{ x: number; z: number; rotY: number; len: number }> = [];

  const step = 1.6;
  const countX = Math.round((FENCE_X * 2) / step);
  const countZ = Math.round((FENCE_Z * 2) / step);

  for (let i = 0; i <= countX; i += 1) {
    const x = -FENCE_X + (i * (FENCE_X * 2)) / countX;
    postPositions.push({ x, z: -FENCE_Z }, { x, z: FENCE_Z });
  }
  for (let i = 1; i < countZ; i += 1) {
    const z = -FENCE_Z + (i * (FENCE_Z * 2)) / countZ;
    postPositions.push({ x: -FENCE_X, z }, { x: FENCE_X, z });
  }

  const railLen = (FENCE_X * 2) / countX;
  for (let i = 0; i < countX; i += 1) {
    const x = -FENCE_X + (i + 0.5) * railLen;
    rails.push({ x, z: -FENCE_Z, rotY: 0, len: railLen - 0.12 });
    rails.push({ x, z: FENCE_Z, rotY: 0, len: railLen - 0.12 });
  }
  const railLenZ = (FENCE_Z * 2) / countZ;
  for (let i = 0; i < countZ; i += 1) {
    const z = -FENCE_Z + (i + 0.5) * railLenZ;
    rails.push({ x: -FENCE_X, z, rotY: Math.PI / 2, len: railLenZ - 0.12 });
    rails.push({ x: FENCE_X, z, rotY: Math.PI / 2, len: railLenZ - 0.12 });
  }

  const postGeo = new THREE.BoxGeometry(0.16, 0.86, 0.16);
  const postMesh = new THREE.InstancedMesh(postGeo, mat(WOOD), postPositions.length);
  const dummy = new THREE.Object3D();
  postPositions.forEach((p, i) => {
    dummy.position.set(p.x, 0.43, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  group.add(postMesh);

  const railGeo = new THREE.BoxGeometry(1, 0.09, 0.07);
  const railMesh = new THREE.InstancedMesh(railGeo, mat(0xc08f5c), rails.length);
  rails.forEach((r, i) => {
    dummy.position.set(r.x, 0.56, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.len, 1, 1);
    dummy.updateMatrix();
    railMesh.setMatrixAt(i, dummy.matrix);
  });
  railMesh.castShadow = true;
  group.add(railMesh);

  return group;
}

function buildBarn(): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.1, 2.6), mat(0xb65a42));
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.45, 0.08), mat(0xf0e3c9));
  door.position.set(0, 0.75, 1.32);
  group.add(door);

  const roofMat = mat(0x7c4a3a, 0.9);
  const slabGeo = new THREE.BoxGeometry(1.95, 0.16, 2.94);
  const slope = 0.42;
  [-1, 1].forEach((dir) => {
    const slab = new THREE.Mesh(slabGeo, roofMat);
    slab.position.set(dir * 0.86, 2.5, 0);
    slab.rotation.z = -dir * slope;
    slab.castShadow = true;
    group.add(slab);
  });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.0), mat(0x6b3f31));
  ridge.position.y = 2.92;
  ridge.castShadow = true;
  group.add(ridge);

  const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8), mat(0xdfbe6a));
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-1.95, 0.3, 0.6);
  hay.castShadow = true;
  group.add(hay);

  group.position.set(-4.9, 0, -4.9);
  group.rotation.y = 0.22;
  return group;
}

function buildWell(): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.85, 10), mat(0xb6ae9f, 0.95));
  base.position.y = 0.42;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 10), mat(0x4d8fa6, 0.4));
  water.position.y = 0.86;
  group.add(water);

  const postGeo = new THREE.BoxGeometry(0.1, 1.2, 0.1);
  [-0.5, 0.5].forEach((x) => {
    const post = new THREE.Mesh(postGeo, mat(WOOD_DARK));
    post.position.set(x, 1.4, 0);
    post.castShadow = true;
    group.add(post);
  });

  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 0.09), mat(WOOD_DARK));
  beam.position.y = 1.97;
  beam.castShadow = true;
  group.add(beam);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 4), mat(0x8d5b41));
  roof.position.y = 2.02;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  group.position.set(4.85, 0, -4.6);
  return group;
}

function buildTree(x: number, z: number, scale: number, hue: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.15, 6),
    mat(0x8a6242, 0.95)
  );
  trunk.position.y = 0.58;
  trunk.castShadow = true;
  group.add(trunk);

  const tones = [0x5f9a48, 0x6ba84f, 0x548c3f];
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78 - i * 0.13, 0), mat(tones[(i + hue) % 3]));
    crown.position.set((i - 1) * 0.22, 1.35 + i * 0.42, (i % 2 === 0 ? 0.12 : -0.14));
    crown.rotation.set(i * 0.4, i * 0.9, 0);
    crown.castShadow = true;
    group.add(crown);
  }

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
}

function buildSign(): THREE.Group {
  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.1),
    new THREE.MeshStandardMaterial({
      map: createSignTexture(),
      roughness: 0.8,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  board.position.y = 1.35;
  board.castShadow = true;
  group.add(board);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.07), mat(0xc9a06f));
  back.position.set(0, 1.35, -0.05);
  group.add(back);

  [-0.8, 0.8].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), mat(WOOD_DARK));
    post.position.set(x, 0.8, -0.05);
    post.castShadow = true;
    group.add(post);
  });

  group.position.set(-3.7, 0, 6.3);
  group.rotation.y = Math.PI / 4;
  return group;
}

function createGlowSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,246,214,1)");
  grad.addColorStop(0.35, "rgba(255,238,186,0.55)");
  grad.addColorStop(1, "rgba(255,232,170,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 空气里的暖色光尘：主光方向上的细碎亮点，让画面有光照在空气里的层次 */
function createDustMotes(): { points: THREE.Points; update: (t: number) => void } {
  const count = 72;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = 0.5 + Math.random() * 4.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    seeds[i] = Math.random() * Math.PI * 2;
    heights[i] = 0.5 + Math.random() * 4.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: createGlowSprite(),
    color: 0xfff3c4,
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;

  const update = (t: number) => {
    const attr = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      const y = heights[i] + Math.sin(t * 0.35 + seeds[i]) * 0.35;
      attr.setY(i, y);
      attr.setX(i, attr.getX(i) + Math.sin(t * 0.2 + seeds[i]) * 0.0006);
    }
    attr.needsUpdate = true;
    material.opacity = 0.3 + Math.sin(t * 0.8) * 0.07;
  };

  return { points, update };
}

export interface World {
  group: THREE.Group;
  ground: THREE.Mesh;
  update?: (t: number) => void;
}

export function createWorld(): World {
  const group = new THREE.Group();

  // 草地
  const groundMat = new THREE.MeshStandardMaterial({
    map: createGrassTexture(),
    roughness: 0.96,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 田埂：地块下方的土层
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 12.6),
    mat(0xc5a173, 0.95)
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.014, 0);
  field.receiveShadow = true;
  group.add(field);

  group.add(buildFence());
  group.add(buildBarn());
  group.add(buildWell());
  group.add(buildSign());

  const dust = createDustMotes();
  group.add(dust.points);

  const trees: Array<[number, number, number]> = [
    [-9.2, -7.4, 1.15],
    [-9.6, -1.2, 1],
    [-8.9, 5.2, 1.2],
    [9.1, -6.8, 1.05],
    [9.5, -0.4, 1.25],
    [8.6, 5.6, 0.95],
    [-2.2, -10.4, 1.3],
    [2.4, -10.8, 1.1],
    [-5.6, 9.9, 1.2],
    [5.2, 10.2, 1.05],
  ];
  trees.forEach(([x, z, s], i) => group.add(buildTree(x, z, s, i)));

  // 石头与草丛：只用来打破草地的均匀感
  const rockGeo = new THREE.DodecahedronGeometry(0.36, 0);
  [
    [3.4, 7.6, 0.9],
    [-5.3, 2.4, 0.7],
    [6.6, 2.8, 1],
    [-1.6, -8.4, 0.8],
  ].forEach(([x, z, s]) => {
    const rock = new THREE.Mesh(rockGeo, mat(0xa9a396, 0.95));
    rock.position.set(x, 0.16, z);
    rock.scale.set(s, s * 0.7, s);
    rock.rotation.set(0.2, x, 0.1);
    rock.castShadow = true;
    group.add(rock);
  });

  const tuftGeo = new THREE.ConeGeometry(0.12, 0.34, 4);
  const tuftMat = mat(0x61954a, 0.95);
  [
    [-4.2, 5.2],
    [4.4, 5.4],
    [-5.8, -6.2],
    [6.1, -2.4],
    [-2.4, 8.6],
    [2.8, 8.8],
  ].forEach(([x, z], i) => {
    for (let k = 0; k < 3; k += 1) {
      const tuft = new THREE.Mesh(tuftGeo, tuftMat);
      tuft.position.set(x + (k - 1) * 0.16, 0.17, z + ((i + k) % 2 === 0 ? 0.1 : -0.1));
      tuft.rotation.z = (k - 1) * 0.12;
      group.add(tuft);
    }
  });

  return { group, ground, update: dust.update };
}
