import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PALETTE, clay } from "./materials";

/** 固定种子随机：每次刷新场景细节一样，不会东一块西一块地跳 */
let seed = 9781;
function rnd(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function between(min: number, max: number): number {
  return min + rnd() * (max - min);
}

/** 揉皱的球：顶点随机偏移，得到不规则但连续的有机外形，用在树冠、石头和土块上 */
export function lumpy(radius: number, detail: number, amount: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + Math.sin(v.x * 5.1 + v.z * 3.7) * amount + Math.sin(v.y * 4.3 - v.x * 2.1) * amount * 0.6;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rounded(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, 2, r);
}

function addShadow<M extends THREE.Mesh>(mesh: M, receive = true): M {
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  return mesh;
}

/* ---------------- 谷仓 ---------------- */

function gableTriangle(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function buildBarn(): THREE.Group {
  const group = new THREE.Group();
  const W = 3.2;
  const H = 2.0;
  const D = 2.8;

  // 石基
  const base = addShadow(new THREE.Mesh(rounded(W + 0.3, 0.22, D + 0.3, 0.06), clay(PALETTE.stone)));
  base.position.y = 0.1;
  group.add(base);

  // 墙体
  const wall = addShadow(new THREE.Mesh(rounded(W, H, D, 0.08), clay(PALETTE.barnRed, { roughness: 0.9 })));
  wall.position.y = 0.22 + H / 2;
  group.add(wall);

  // 正面的竖木板：深浅两色交替，读起来是"一块块钉起来的墙"
  for (let i = 0; i < 9; i += 1) {
    const slat = new THREE.Mesh(
      rounded(0.3, H - 0.08, 0.05, 0.02),
      clay(i % 2 === 0 ? 0xcf5d47 : 0xc85743, { roughness: 0.92 })
    );
    slat.position.set(-W / 2 + 0.24 + i * 0.345, 0.22 + H / 2, D / 2 + 0.02);
    group.add(slat);
  }

  // 山墙三角
  [-1, 1].forEach((dir) => {
    const gable = addShadow(
      new THREE.Mesh(gableTriangle(W, 0.78, 0.1), clay(0xc85743, { roughness: 0.92 }))
    );
    gable.position.set(0, 0.22 + H, dir * (D / 2 - 0.02));
    group.add(gable);
  });

  // 屋面：两块斜板各自成组，瓦片贴着坡面排，不再悬空乱飞
  const roofLen = D + 0.6;
  const ridgeY = 0.22 + H + 0.82;
  const slopeAngle = Math.atan2(0.82, W / 2 + 0.28);
  const slopeLen = Math.hypot(W / 2 + 0.28, 0.82);
  [-1, 1].forEach((dir) => {
    const side = new THREE.Group();
    side.position.set(0, ridgeY, 0);
    side.rotation.z = -dir * slopeAngle;
    group.add(side);

    const slab = addShadow(
      new THREE.Mesh(rounded(slopeLen, 0.14, roofLen, 0.05), clay(0xb94a38, { roughness: 0.9 }))
    );
    slab.position.set((dir * slopeLen) / 2, 0, 0);
    side.add(slab);

    // 瓦片：四排，贴着坡面板面往上叠，边缘略翘
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const tile = new THREE.Mesh(
          rounded(slopeLen / 4 - 0.03, 0.055, roofLen / 5 - 0.03, 0.024),
          clay((row + col) % 2 === 0 ? 0xd05a44 : 0xc8553f, { roughness: 0.9 })
        );
        tile.position.set(
          dir * (slopeLen * (0.13 + row * 0.25)),
          0.085,
          -roofLen / 2 + roofLen / 10 + col * (roofLen / 5)
        );
        tile.rotation.x = row % 2 === 0 ? 0.03 : -0.02;
        side.add(tile);
      }
    }
  });

  const ridge = addShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, roofLen, 10), clay(PALETTE.cream))
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = ridgeY + 0.06;
  group.add(ridge);

  // 正面大门：白门 + 红色 X 撑条 + 门框
  const door = new THREE.Mesh(rounded(1.0, 1.55, 0.1, 0.04), clay(PALETTE.cream, { roughness: 0.85 }));
  door.position.set(0, 0.22 + 0.78, D / 2 + 0.05);
  addShadow(door);
  group.add(door);

  [1, -1].forEach((k) => {
    const brace = new THREE.Mesh(rounded(0.09, 1.5, 0.06, 0.02), clay(PALETTE.barnRed));
    brace.position.set(0, 0.22 + 0.78, D / 2 + 0.11);
    brace.rotation.z = k * 0.55;
    group.add(brace);
  });

  const frameTop = addShadow(new THREE.Mesh(rounded(1.2, 0.12, 0.12, 0.04), clay(PALETTE.cream)));
  frameTop.position.set(0, 0.22 + 1.6, D / 2 + 0.06);
  group.add(frameTop);

  // 阁楼小门
  const loft = new THREE.Mesh(rounded(0.5, 0.4, 0.06, 0.02), clay(PALETTE.cream));
  loft.position.set(0, 0.22 + H + 0.22, D / 2 + 0.03);
  group.add(loft);

  // 两扇窗：白框 + 十字格
  [-0.95, 0.95].forEach((x) => {
    const win = new THREE.Mesh(rounded(0.5, 0.5, 0.07, 0.03), clay(0xfff8e6, { roughness: 0.8 }));
    win.position.set(x, 0.22 + 1.15, D / 2 + 0.03);
    group.add(win);
    const barV = new THREE.Mesh(rounded(0.06, 0.5, 0.04, 0.015), clay(PALETTE.barnRed));
    barV.position.set(x, 0.22 + 1.15, D / 2 + 0.07);
    group.add(barV);
    const barH = new THREE.Mesh(rounded(0.5, 0.06, 0.04, 0.015), clay(PALETTE.barnRed));
    barH.position.set(x, 0.22 + 1.15, D / 2 + 0.07);
    group.add(barH);
  });

  // 门边的草垛与木桶
  const hay = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 14), clay(0xf0c45f, { roughness: 0.95 })));
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-2.05, 0.36, 0.6);
  group.add(hay);

  const barrel = new THREE.Group();
  const barrelBody = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.55, 12), clay(PALETTE.wood)));
  barrelBody.position.y = 0.28;
  barrel.add(barrelBody);
  [0.12, 0.44].forEach((y) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 14), clay(PALETTE.woodDark));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    barrel.add(hoop);
  });
  barrel.position.set(1.95, 0, 0.8);
  group.add(barrel);

  // The gable end and side wall are visible at player height. Projecting eaves,
  // limewashed corner trim and dark glazing give the barn readable depth.
  const trim = clay(0xf3ddb3);
  for (const x of [-1, 1]) {
    for (const z of [-1,1]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(.11,H,.12),trim);
      corner.position.set(x*(W/2-.03),H/2+.22,z*(D/2-.035));
      group.add(corner);
    }
    const sideZ = .08;
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(.091,.87,1.06),trim);
    jamb.position.set(x*(W/2+.018),1.36,sideZ);
    group.add(jamb);
    for (const k of [-1,1]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(.043,.67,.36),clay(0x5f8587));
      pane.position.set(x*(W/2+.078),1.35,sideZ+k*.22);
      group.add(pane);
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(.09,.83,.28),clay(0x738c82));
      shutter.position.set(x*(W/2+.075),1.35,sideZ+k*.70);
      group.add(shutter);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(.29,.21,1.23),clay(0xbd946d));
    box.position.set(x*(W/2+.14),.90,sideZ);
    group.add(box);
    for (let i=0;i<6;i++) {
      const sprig = buildFlower(i%3 === 0 ? 0xe5a0b3 : 0xffdf9e);
      sprig.position.set(x*(W/2+.16),1.0,sideZ+i*.17-.42);
      sprig.scale.setScalar(.8);
      group.add(sprig);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.099,.055,.99),trim);
    bar.position.set(x*(W/2+.10),1.36,sideZ);
    group.add(bar);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(.13,.16,D+.72),clay(0xefcfa5));
    eave.position.set(x*(W/2+.26),ridgeY-.82,0);
    group.add(eave);
  }
  for (const y of [0.43,.97]) {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(.22,.058,.064),clay(0x786859));
    hinge.position.set(-.36,y+.24,D/2+.13);
    group.add(hinge);
  }
  // The ridgeline carries a timber cupola, a folded copper cap and a swallow vane.
  const detail = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, clay(color));
    mesh.position.set(x,y,z);
    group.add(mesh);
    return mesh;
  };
  const board = (color: number, x: number, y: number, z: number, w: number, h: number, d: number) =>
    detail(new THREE.BoxGeometry(w,h,d),color,x,y,z);
  const copper = 0x537a73, cream = 0xf5dfa7, timber = 0x6e5141;
  board(timber, 0, 3.15, -.21, .93, .24, .89);
  board(cream, 0, 3.45, -.21, .74, .54, .69);
  for (const side of [-1,1]) {
    board(timber,0,3.45,-.21+side*.35,.53,.35,.028);
    board(timber,side*.38,3.45,-.21,.028,.35,.48);
    for (let i = 0; i < 4; i++) {
      board(0xc4ab80,0,3.30+i*.085,-.21+side*.37,.55,.032,.055);
      board(0xc4ab80,side*.397,3.30+i*.085,-.21,.055,.032,.51);
    }
  }
  board(cream,0,3.74,-.21,1,.09,.92);
  const cap = detail(new THREE.ConeGeometry(.72,.53,4),copper,0,4.02,-.21);
  cap.rotation.y=Math.PI/4; cap.scale.z=.92;
  detail(new THREE.CylinderGeometry(.015,.022,.41,7),timber,0,4.41,-.21);
  detail(new THREE.OctahedronGeometry(.058),0xe1b96b,0,4.37,-.21);
  board(timber,0,4.55,-.21,.56,.027,.028);
  const vane = new THREE.Shape();
  vane.moveTo(-.24,.11);vane.lineTo(-.12,.04);vane.lineTo(-.06,.10);
  vane.lineTo(.02,.062);vane.lineTo(.13,.12);vane.lineTo(.16,.08);
  vane.lineTo(.24,.065);vane.lineTo(.16,.045);vane.quadraticCurveTo(.10,-.05,-.05,-.045);
  vane.lineTo(-.24,-.02);vane.lineTo(-.15,.035);vane.closePath();
  detail(new THREE.ExtrudeGeometry(vane,{depth:.028,bevelEnabled:false}),0xb98a4f,0,4.58,-.22);

  // Dark window recesses sit behind cream muntins. A little patinated canopy
  // and gable brackets cast shadows over the double door at player height.
  for (const x of [-.95,.95]) {
    for (const dx of [-.105,.105]) for (const dy of [-.105,.105]) {
      board(dy>0?0x688e91:0x93ada7,x+dx,1.37+dy,1.474,.158,.158,.015);
    }
  }
  board(0x946247,0,1.04,1.518,.023,1.48,.022);
  for (const side of [-1,1]) {
    detail(new THREE.SphereGeometry(.042,8,6),0xb69a64,side*.082,.93,1.55);
    board(timber,side*.62,1.83,1.53,.075,.46,.08).rotation.x=.57;
    board(cream,side*.84,2.64,1.475,1.83,.074,.085).rotation.z=-side*slopeAngle;
    board(0x9d7051,side*.45,2.48,1.46,.076,.55,.065).rotation.z=side*.66;
  }
  board(0x5f7567,0,1.99,1.64,1.59,.105,.57).rotation.x=.18;
  board(cream,0,1.955,1.92,1.64,.07,.077);
  for (const x of [-.70,-.35,0,.35,.70]) {
    board(copper,x,2.05,1.64,.035,.035,.58).rotation.x=.18;
  }
  // Split the straw roll into tied layers, with woven rings visible on the ends.
  for (const offset of [-.15,.15]) {
    const band = detail(new THREE.TorusGeometry(.341,.018,5,14),0xc89250,-2.05+offset,.36,.6);
    band.rotation.y=Math.PI/2;
  }
  for (const side of [-1,1]) {
    const coil = detail(new THREE.TorusGeometry(.18,.017,4,14),0xddab50,-2.05+side*.256,.36,.6);
    coil.rotation.y=Math.PI/2;
  }
  return group;
}

/* ---------------- 水井 ---------------- */

export function buildWell(): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.72;

  // 井壁：一圈圈石头错缝砌起来，不再是光溜溜一个圆柱
  for (let row = 0; row < 3; row += 1) {
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + (row % 2 === 0 ? 0 : Math.PI / count);
      const stone = new THREE.Mesh(
        rounded(0.27, 0.26, 0.2, 0.05),
        clay(row === 1 ? 0xcec8b8 : PALETTE.stone, { roughness: 0.95 })
      );
      stone.position.set(Math.cos(a) * radius, 0.16 + row * 0.27, Math.sin(a) * radius);
      stone.rotation.y = -a + Math.PI / 2;
      stone.rotation.x = between(-0.04, 0.04);
      addShadow(stone);
      group.add(stone);
    }
  }

  const water = new THREE.Mesh(new THREE.CircleGeometry(0.62, 26), clay(PALETTE.water, { roughness: 0.4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.78;
  group.add(water);

  // 木架 + 横梁 + 摇柄 + 吊桶
  [-0.5, 0.5].forEach((x) => {
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 1.3, 10), clay(PALETTE.wood)));
    post.position.set(x, 1.45, 0);
    group.add(post);
  });

  const beam = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.16, 10), clay(PALETTE.plank)));
  beam.rotation.z = Math.PI / 2;
  beam.position.y = 2.06;
  group.add(beam);

  const crank = new THREE.Group();
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), clay(PALETTE.woodDark));
  axle.rotation.z = Math.PI / 2;
  crank.add(axle);
  const handleArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), clay(PALETTE.woodDark));
  handleArm.position.set(0.16, -0.17, 0);
  crank.add(handleArm);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), clay(PALETTE.plank));
  handle.position.set(0.16, -0.34, 0);
  crank.add(handle);
  crank.position.set(0.52, 2.02, 0);
  group.add(crank);

  const bucket = new THREE.Group();
  const bucketBody = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 12), clay(PALETTE.plank)));
  bucketBody.position.y = -0.13;
  bucket.add(bucketBody);
  const bucketHoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 12), clay(PALETTE.woodDark));
  bucketHoop.rotation.x = Math.PI / 2;
  bucketHoop.position.y = -0.02;
  bucket.add(bucketHoop);
  bucket.position.set(0, 1.75, 0);
  group.add(bucket);

  // 井顶：两片坡瓦 + 屋脊，和谷仓同一套屋顶语言
  [-1, 1].forEach((dir) => {
    const slab = addShadow(new THREE.Mesh(rounded(0.95, 0.1, 1.3, 0.04), clay(PALETTE.roofRed, { roughness: 0.9 })));
    slab.position.set(dir * 0.42, 2.32, 0);
    slab.rotation.z = -dir * 0.5;
    group.add(slab);
  });
  const ridge = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 8), clay(PALETTE.cream)));
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 2.56;
  group.add(ridge);

  group.position.set(4.85, 0, -4.6);
  return group;
}

/* ---------------- 树 ---------------- */

/** 一个山头：多段锥体，顶点按正弦噪声挤歪，山脚外撑、山尖收住 */
function makePeak(radius: number, height: number, segments: number, variant: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, height, segments, 4, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  const foothill = new THREE.Color(0x728f82);
  const mountain = new THREE.Color(0x81979b);
  const rock = new THREE.Color(0xbbc6bc);
  const peakColor = new THREE.Color();
  const skew = variant * 2.13;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = (v.y + height / 2) / height;
    const theta = Math.atan2(v.z, v.x);
    const ridge = 1 + .18*Math.sin(theta*3. + skew) + .08*Math.sin(theta*5. - skew);
    const shoulder = 1 + .22*Math.sin(t * Math.PI*1.7);
    v.x = v.x * ridge * shoulder + radius * .19 * t*t * Math.sin(skew);
    v.z = v.z * ridge * shoulder + radius * .26 * t*t * Math.cos(skew);
    v.y += height*.105 * Math.sin(theta*2.+skew) * Math.sin(t*Math.PI);
    pos.setXYZ(i, v.x, v.y, v.z);
    const crag = THREE.MathUtils.smoothstep(t + .10*Math.sin(3.*theta+skew), .39, .91);
    peakColor.copy(foothill).lerp(mountain, THREE.MathUtils.smoothstep(t, .10,.46)).lerp(rock,crag*.70);
    peakColor.toArray(colors, i*3);
  }
  geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo,flowerMaterial());
}

/** 远山：主峰 + 两座侧峰 + 山脚矮丘，一座就是一小段山脊 */
export function buildMountain(radius: number, height: number, variant: number): THREE.Group {
  const group = new THREE.Group();

  const main = makePeak(radius, height, 9 + (variant % 4), variant);
  main.position.y = height / 2 - 1.4; // 山脚压进草地，不露锥底
  group.add(main);

  // 侧峰错开高度与方位，山脊有起伏才不像一排三角形路障
  for (let s = 0; s < 2; s += 1) {
    const ang = variant * 1.7 + s * 2.4;
    const r2 = radius * (0.48 + 0.1 * s);
    const h2 = height * (0.5 + 0.12 * s);
    const side = makePeak(r2, h2, 8, variant + s * 3);
    side.position.set(Math.cos(ang) * radius * 0.66, h2 / 2 - 1.4, Math.sin(ang) * radius * 0.66);
    group.add(side);
  }

  // 山脚一圈矮丘，把山体和草地的接缝盖住
  const foot = new THREE.Mesh(
    lumpy(radius * 0.46, 1, 0.22),
    clay(PALETTE.mountainDark, { roughness: 0.96, flatShading: true })
  );
  foot.scale.set(1.5, 0.3, 1.45);
  foot.position.y = 0.1;
  group.add(foot);

  return group;
}

/** Three silhouettes share the meadow: orchard trees, flowering cherries and cypresses. */
export function buildTree(scale: number, variant: number): THREE.Group {
  const tree = new THREE.Group();
  const blossom = variant % 7 === 1;
  const cypress = variant % 5 === 4 && !blossom;
  const bark = clay(blossom ? 0x795c66 : 0x8c674c);
  const wood = (start: THREE.Vector3, end: THREE.Vector3, base: number, tip: number) => {
    const axis = end.clone().sub(start);
    const twig = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(tip, base, axis.length(), 7), bark));
    twig.position.copy(start).lerp(end, 0.5);
    twig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    tree.add(twig);
  };
  const fork = new THREE.Vector3(0.09, 1.12, 0);
  wood(new THREE.Vector3(), fork, 0.20, 0.11);
  const crownColors = blossom
    ? [0xd892a8, 0xf4b6c5, 0xf8ccd3, 0xdd94a9, 0xffdfdc]
    : [0x689b65, 0x83aa64, 0xa0c477, 0x77a86d, 0xc0d88a];
  if (cypress) {
    for (let tier = 0; tier < 4; tier++) {
      const cone = addShadow(new THREE.Mesh(
        new THREE.ConeGeometry(0.90 - tier * 0.17, 1.4 - tier * 0.15, 9),
        clay([0x386e61, 0x488875, 0x63a28b, 0x82b6a0][tier], { flatShading: true })
      ));
      cone.position.set(0.08, 1.30 + tier * 0.40, 0);
      cone.rotation.y = tier * 0.49;
      tree.add(cone);
    }
  } else {
    const lobes = [
      [-0.55, 1.65, 0.15, 0.75], [0.5, 1.84, 0.24, 0.70],
      [0.12, 2.09, -0.35, 0.91], [-0.31, 2.25, 0.28, 0.70],
      [0.16, 2.50, 0.02, 0.53],
    ];
    lobes.forEach(([x, y, z, r], index) => {
      if (index < 3) wood(fork, new THREE.Vector3(x, y, z), 0.10, 0.045);
      const geo = lumpy(r, 1, 0.15);
      const positions = geo.getAttribute("position");
      const colors = new Float32Array(positions.count * 3);
      const shaded = new THREE.Color(crownColors[index]);
      const tip = shaded.clone().lerp(new THREE.Color(blossom ? 0xffebdf : 0xd8e8a0), 0.36);
      const c = new THREE.Color();
      for (let i = 0; i < positions.count; i++) {
        c.copy(shaded).lerp(tip, THREE.MathUtils.smoothstep(positions.getY(i) / r, -0.25, 0.9)).toArray(colors, i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const crown = addShadow(new THREE.Mesh(geo, flowerMaterial()));
      crown.position.set(x, y, z);
      crown.scale.set(1.17, blossom ? 0.67 : 0.82, 1);
      crown.rotation.y = index * 1.61;
      tree.add(crown);
    });
  }
  tree.scale.setScalar(scale);
  return tree;
}

/* ---------------- 石头 / 草丛 / 花 / 灌木 ---------------- */

export function buildRock(scale: number) {
  const rock = addShadow(new THREE.Mesh(lumpy(0.36, 2, 0.16), clay(0xcfcaba, { roughness: 0.95 })));
  rock.scale.set(scale, scale * 0.72, scale * 1.05);
  rock.position.y = 0.17;
  rock.rotation.y = between(0, Math.PI);
  return rock;
}

export function buildGrassTuft(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(grassTuftGeometry(), grassTuftMaterial()));
  return group;
}

export function buildFlower(color: number): THREE.Group {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 6), clay(PALETTE.leafDark));
  stem.position.y = 0.13;
  group.add(stem);

  const leaf = new THREE.Mesh(lumpy(0.07, 1, 0.2), clay(PALETTE.leaf));
  leaf.scale.set(1.6, 0.5, 1);
  leaf.position.set(0.07, 0.12, 0);
  leaf.rotation.z = 0.4;
  group.add(leaf);

  // 五片花瓣，比一个大球更像花
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), clay(color, { roughness: 0.8 }));
    petal.position.set(Math.cos(a) * 0.055, 0.3, Math.sin(a) * 0.055);
    petal.scale.set(1, 0.6, 1);
    group.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), clay(PALETTE.flowerYellow));
  center.position.y = 0.305;
  group.add(center);

  group.rotation.y = between(0, Math.PI);
  return group;
}

/* ---------------- 可实例化的草丛与野花 ----------------
 * 草原上要密铺几千簇草和花，一簇三个 mesh、一朵花八个 mesh 会把 draw call 撑爆。
 * 这里把部件合并成一份几何、用顶点色区分茎叶花瓣，交给 InstancedMesh 一次画完。 */

/** 给整份几何统一涂一个颜色，合并后各部件就还分得清 */
function tinted(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

let tuftGeoCache: THREE.BufferGeometry | null = null;
/** Seven folded, tapered blades. Opaque triangles avoid alpha-card overdraw. */
export function grassTuftGeometry(): THREE.BufferGeometry {
  if (tuftGeoCache) return tuftGeoCache;
  const xyz: number[] = [], colors: number[] = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.40, x = Math.cos(a), z = Math.sin(a);
    const r = 0.045 + (i % 3) * 0.025, w = 0.031;
    const h = 0.16 + (i % 4) * 0.065, lean = r + h * 0.52;
    const left = [r*x - w*z, 0, r*z + w*x], right = [r*x + w*z, 0, r*z - w*x];
    const fold = [x*(r+0.02), h*0.54, z*(r+0.02)], tip = [x*lean, h, z*lean];
    xyz.push(...left, ...fold, ...tip, ...fold, ...right, ...tip);
    for (const hex of [0x53845f, 0x87af6c, 0xb7cd84, 0x6d9b63, 0x54845e, 0xb0c97e]) {
      const c = new THREE.Color(hex);
      colors.push(c.r, c.g, c.b);
    }
  }
  tuftGeoCache = new THREE.BufferGeometry();
  tuftGeoCache.setAttribute("position", new THREE.Float32BufferAttribute(xyz, 3));
  tuftGeoCache.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  tuftGeoCache.computeVertexNormals();
  return tuftGeoCache;
}

const windTime = { value: 0 };
export function updateGrassWind(t: number) { windTime.value = t; }

function meadowVertexShader(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windTime;
    shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 origin = instanceMatrix[3].xz;
        float seed = fract(sin(dot(origin,vec2(19.23,71.1)))*1673.42);
        float distanceToEye = distance(instanceMatrix[3].xyz, cameraPosition);
        // Thin out the smallest silhouettes gradually before they become subpixel.
        float limit = 27.+seed*39.;
        transformed *= 1.-smoothstep(limit,limit+9.,distanceToEye);
        transformed.x += transformed.y*transformed.y*.32*sin(windTime*1.9+origin.x*.6+origin.y*.37);
      #endif
    `);
  };
  return material;
}

let tuftMatCache: THREE.MeshStandardMaterial | null = null;
export function grassTuftMaterial(): THREE.MeshStandardMaterial {
  tuftMatCache ??= meadowVertexShader(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }));
  return tuftMatCache;
}

const flowerGeoCache = new Map<number, THREE.BufferGeometry>();
/** 一朵花：茎 + 叶 + 五片花瓣 + 花心，按颜色合并成一份几何 */
export function flowerGeometry(color: number): THREE.BufferGeometry {
  const cached = flowerGeoCache.get(color);
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [];

  const stem = new THREE.CylinderGeometry(0.009, 0.014, 0.30, 3, 1, true).toNonIndexed();
  stem.translate(0, 0.15, 0);
  parts.push(tinted(stem, PALETTE.leafDark));

  const petals = new THREE.BufferGeometry();
  const xyz: number[] = [], colors: number[] = [];
  const inner = new THREE.Color(color), outer = inner.clone().lerp(new THREE.Color(0xfff5df), 0.55);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4, x = Math.cos(a), z = Math.sin(a);
    const l = [0.057*x - 0.031*z, 0.31, 0.057*z + 0.031*x];
    const r = [0.057*x + 0.031*z, 0.31, 0.057*z - 0.031*x];
    const middle = [0, 0.28, 0], tip = [0.093*x, 0.323, 0.093*z];
    xyz.push(...middle, ...l, ...tip, ...middle, ...tip, ...r);
    for (const c of [inner, outer, outer, inner, outer, outer]) colors.push(c.r,c.g,c.b);
  }
  petals.setAttribute("position", new THREE.Float32BufferAttribute(xyz, 3));
  petals.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  petals.computeVertexNormals();
  const core = new THREE.OctahedronGeometry(0.024);
  core.scale(1, 0.65, 1);
  core.translate(0, 0.305, 0);
  parts.push(tinted(core, PALETTE.flowerYellow), petals);
  for (const part of parts) part.deleteAttribute("uv");

  const merged = mergeGeometries(parts, false)!;
  flowerGeoCache.set(color, merged);
  return merged;
}

let flowerMatCache: THREE.MeshStandardMaterial | null = null;
export function flowerMaterial(): THREE.MeshStandardMaterial {
  flowerMatCache ??= meadowVertexShader(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
  }));
  return flowerMatCache;
}

export function buildBush(scale: number, variant: number): THREE.Group {
  const group = new THREE.Group();
  const greens = [PALETTE.leafDark, PALETTE.leaf, PALETTE.leafLight];
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.3, 0, 0.34],
    [-0.24, 0.24, 0.1, 0.24],
    [0.26, 0.26, -0.06, 0.22],
    [0.05, 0.44, 0.02, 0.2],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const blob = addShadow(new THREE.Mesh(lumpy(r, 2, 0.12), clay(greens[(i + variant) % greens.length])));
    blob.position.set(x, y, z);
    group.add(blob);
  });
  group.scale.setScalar(scale);
  return group;
}
