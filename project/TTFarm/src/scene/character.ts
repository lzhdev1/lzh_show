import * as THREE from "three";

export interface AvatarRig {
  visual: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  animate?: (dt: number, t: number, moving: boolean, phase: number) => void;
  dispose: () => void;
}

const SKIN = 0xf0cfb4;
const OUTLINE = 0x4a3128;
const HAIR_TIE = 0xe0703c;
const COLLAR = 0x2b3f6b;

let gradientTexture: THREE.DataTexture | null = null;
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();

/** 三段阶梯的 toon 明暗，卡通渲染靠它把受光面压成干净的色块 */
function toonGradient(): THREE.DataTexture {
  if (gradientTexture) return gradientTexture;
  const data = new Uint8Array([90, 90, 90, 255, 176, 176, 176, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  gradientTexture = tex;
  return tex;
}

function loadTexture(file: string, repeat: [number, number]): THREE.Texture {
  const key = `${file}|${repeat[0]}|${repeat[1]}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const tex = textureLoader.load(`${import.meta.env.BASE_URL}textures/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

function toon(color: number, map?: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, map: map ?? null, gradientMap: toonGradient() });
}

/** 裙摆的褶：按角度做径向起伏，比纯圆锥更像百褶裙 */
function pleatedSkirt(): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(0.152, 0.275, 0.29, 24, 2, true);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const scale = 1 - 0.055 + 0.055 * Math.cos(angle * 12);
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function buildGirlRig(): AvatarRig {
  const visual = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const track = <T extends THREE.Mesh>(mesh: T, outlineScale?: number): T => {
    geometries.push(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => materials.push(m));
    } else {
      materials.push(mesh.material);
    }
    if (outlineScale) {
      const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
      materials.push(outlineMat);
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.scale.setScalar(outlineScale);
      mesh.add(outline);
    }
    return mesh;
  };

  const faceTex = loadTexture("face.jpg", [1, 1]);
  // 贴图四周留了一圈空白皮肤，裁掉 15% 让五官在 3D 贴面上更饱满
  faceTex.wrapS = THREE.ClampToEdgeWrapping;
  faceTex.wrapT = THREE.ClampToEdgeWrapping;
  faceTex.repeat.set(0.74, 0.7);
  faceTex.offset.set(0.13, 0.16);
  const hairTex = loadTexture("hair.jpg", [2.2, 1.8]);
  const outfitTex = loadTexture("outfit.jpg", [2.5, 1.4]);
  const skirtTex = loadTexture("skirt.jpg", [5, 1.6]);

  const skinMat = toon(SKIN);
  const hairMat = toon(0xffffff, hairTex);
  // 头部发壳用纯色：球面 UV 会把发丝纹理揉成一圈一圈，长发片才用发丝贴图
  const hairSolidMat = toon(0x9b7149);
  const outfitMat = toon(0xffffff, outfitTex);
  const skirtMat = toon(0xf2f4f8, skirtTex);
  const collarMat = toon(COLLAR);
  const tieMat = toon(HAIR_TIE);
  const sockMat = toon(0xf7f4ec);
  const shoeMat = toon(0x5b4034);
  [skinMat, hairMat, hairSolidMat, outfitMat, skirtMat, collarMat, tieMat, sockMat, shoeMat].forEach(
    (m) => materials.push(m)
  );

  // —— 身体 ——
  const body = new THREE.Group();
  visual.add(body);

  const torso = track(
    new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.132, 0.4, 16), outfitMat),
    1.06
  );
  torso.position.y = 1.12;
  torso.castShadow = true;
  body.add(torso);

  // 水手领：后片一块，颈侧用细滚边收口，前面留出领口给蝴蝶结
  const backCollar = track(new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.024, 0.16), collarMat));
  backCollar.position.set(0, 1.3, -0.035);
  body.add(backCollar);

  const neckline = track(new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.016, 6, 20), collarMat));
  neckline.rotation.x = Math.PI / 2;
  neckline.position.y = 1.315;
  body.add(neckline);

  // 领口的蝴蝶结
  [-1, 1].forEach((dir) => {
    const wing = track(
      new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 4), tieMat)
    );
    wing.position.set(dir * 0.045, 1.215, 0.105);
    wing.rotation.set(Math.PI / 2, 0, dir * Math.PI / 2 + dir * 0.25);
    body.add(wing);
  });
  const bowKnot = track(new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), tieMat));
  bowKnot.position.set(0, 1.215, 0.115);
  body.add(bowKnot);

  // 百褶裙
  const skirt = track(new THREE.Mesh(pleatedSkirt(), skirtMat), 1.04);
  skirt.position.y = 0.925;
  skirt.castShadow = true;
  (skirt.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  body.add(skirt);

  const waist = track(new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.014, 6, 18), collarMat));
  waist.rotation.x = Math.PI / 2;
  waist.position.y = 1.075;
  body.add(waist);

  // —— 头 ——
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.52;
  visual.add(headGroup);

  const head = track(
    new THREE.Mesh(new THREE.SphereGeometry(0.152, 24, 20), skinMat),
    1.055
  );
  head.scale.set(1, 1.07, 0.97);
  head.castShadow = true;
  headGroup.add(head);

  // 面部：贴一张球形盖片，比平面卡片更贴合头部曲面
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.163, 28, 24, Math.PI / 2 - 0.62, 1.24, 1.0, 1.26),
    new THREE.MeshBasicMaterial({
      map: faceTex,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  face.scale.copy(head.scale);
  materials.push(face.material as THREE.Material);
  geometries.push(face.geometry);
  head.add(face);

  // 头顶与后脑的头发：分两片做，前额留空，免得帽壳盖到眼睛
  const topCap = track(
    new THREE.Mesh(new THREE.SphereGeometry(0.166, 24, 14, 0, Math.PI * 2, 0, 0.99), hairSolidMat),
    1.05
  );
  topCap.scale.set(1.02, 1.05, 1.04);
  topCap.position.y = 0.012;
  topCap.castShadow = true;
  headGroup.add(topCap);

  const backCap = track(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.166, 24, 18, Math.PI / 2 + 0.92, Math.PI * 2 - 1.84, 0, 1.92),
      hairSolidMat
    ),
    1.05
  );
  backCap.scale.set(1.02, 1.05, 1.04);
  backCap.position.y = 0.012;
  backCap.castShadow = true;
  headGroup.add(backCap);

  // 刘海：从发壳边缘垂到眉毛上方，压在前额外面
  const bangGeo = new THREE.ConeGeometry(0.05, 0.085, 5);
  geometries.push(bangGeo);
  for (let i = 0; i < 5; i += 1) {
    const t = (i - 2) / 2;
    const bang = new THREE.Mesh(bangGeo, hairSolidMat);
    bang.position.set(t * 0.075, 0.098 - Math.abs(t) * 0.004, 0.142 - Math.abs(t) * 0.022);
    bang.rotation.set(Math.PI + 0.16, 0, t * 0.24);
    bang.scale.set(1.3, 1, 0.65);
    headGroup.add(bang);
  }

  // 两侧鬓发
  [-1, 1].forEach((dir) => {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), hairSolidMat);
    geometries.push(lock.geometry);
    lock.position.set(dir * 0.135, -0.14, 0.045);
    lock.rotation.set(Math.PI - 0.06, 0, dir * 0.16);
    lock.scale.set(0.9, 1, 0.75);
    headGroup.add(lock);
  });

  // 及腰的后发（会随步伐摆动）
  const backHair = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.075, 0.72, 16, 3, true),
    hairMat
  );
  geometries.push(backHair.geometry);
  materials.push(backHair.material as THREE.Material);
  (backHair.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  backHair.position.set(0, -0.2, -0.08);
  backHair.castShadow = true;
  headGroup.add(backHair);

  const tails: THREE.Mesh[] = [];
  [-1, 1].forEach((dir) => {
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.016, 0.56, 10), hairMat);
    geometries.push(tail.geometry);
    materials.push(tail.material as THREE.Material);
    tail.position.set(dir * 0.135, -0.26, -0.02);
    tail.rotation.z = dir * 0.08;
    tail.castShadow = true;
    headGroup.add(tail);
    tails.push(tail);

    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.012, 6, 12), tieMat);
    geometries.push(ribbon.geometry);
    materials.push(ribbon.material as THREE.Material);
    ribbon.position.set(dir * 0.135, 0.06, -0.03);
    ribbon.rotation.x = Math.PI / 2;
    headGroup.add(ribbon);
  });

  // 呆毛
  const ahoge = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.02, 0.16, 0.02),
        new THREE.Vector3(0.05, 0.25, 0.01),
        new THREE.Vector3(0.02, 0.3, -0.04),
      ]),
      8,
      0.008,
      6,
      false
    ),
    hairMat
  );
  geometries.push(ahoge.geometry);
  materials.push(ahoge.material as THREE.Material);
  headGroup.add(ahoge);

  // —— 四肢 ——
  const arm = (dir: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(dir * 0.148, 1.26, 0.012);
    body.add(pivot);

    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), outfitMat);
    geometries.push(sleeve.geometry);
    materials.push(sleeve.material as THREE.Material);
    sleeve.position.y = -0.015;
    sleeve.scale.set(1, 0.82, 1);
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.14, 4, 10), skinMat);
    geometries.push(fore.geometry);
    fore.position.y = -0.135;
    fore.castShadow = true;
    pivot.add(fore);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skinMat);
    geometries.push(hand.geometry);
    hand.position.y = -0.235;
    hand.scale.set(1, 0.9, 0.8);
    pivot.add(hand);

    pivot.rotation.z = dir * 0.16;
    return pivot;
  };

  const leg = (dir: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(dir * 0.072, 0.9, 0);
    visual.add(pivot);

    // 大腿、小腿、过膝袜三段互相搭接，避免膝盖处断开
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 4, 10), skinMat);
    geometries.push(thigh.geometry);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    pivot.add(thigh);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.38, 4, 10), sockMat);
    geometries.push(calf.geometry);
    materials.push(calf.material as THREE.Material);
    calf.position.y = -0.575;
    calf.castShadow = true;
    pivot.add(calf);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.032, 10), sockMat);
    geometries.push(band.geometry);
    band.position.y = -0.36;
    pivot.add(band);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.055, 0.135), shoeMat);
    geometries.push(shoe.geometry);
    materials.push(shoe.material as THREE.Material);
    shoe.position.set(0, -0.855, 0.02);
    shoe.castShadow = true;
    pivot.add(shoe);

    return pivot;
  };

  const leftArm = arm(-1);
  const rightArm = arm(1);
  const leftLeg = leg(-1);
  const rightLeg = leg(1);

  // 接触阴影
  const blobGeo = new THREE.CircleGeometry(0.34, 24);
  const blobMat = new THREE.MeshBasicMaterial({
    color: 0x2c2a22,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const blob = new THREE.Mesh(blobGeo, blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  visual.add(blob);
  geometries.push(blobGeo);
  materials.push(blobMat);

  const animate = (_dt: number, t: number, moving: boolean, phase: number) => {
    // 长发与裙摆的次级运动：走得越快，甩得越明显
    const sway = moving ? Math.sin(phase * 0.9) * 0.16 : Math.sin(t * 1.1) * 0.035;
    backHair.rotation.x = 0.06 + sway * 0.55;
    backHair.rotation.z = Math.sin(t * 0.9) * 0.05 + (moving ? Math.sin(phase) * 0.08 : 0);
    tails.forEach((tail, i) => {
      const dir = i === 0 ? -1 : 1;
      tail.rotation.x = 0.04 + sway * 0.7;
      tail.rotation.z = dir * 0.08 + sway * 0.45 * dir;
    });
    ahoge.rotation.z = Math.sin(t * 2.2) * 0.22;
    skirt.scale.x = 1 + (moving ? Math.sin(phase * 2) * 0.02 : 0);
    skirt.scale.z = skirt.scale.x;
    headGroup.rotation.z = moving ? Math.sin(phase) * 0.035 : Math.sin(t * 1.4) * 0.012;
  };

  const dispose = () => {
    geometries.forEach((geo) => geo.dispose());
    materials.forEach((mat) => mat.dispose());
  };

  return {
    visual,
    body,
    head: headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    animate,
    dispose,
  };
}
