import * as THREE from "three";
import { clay } from "./materials";
import { bakeScenery } from "./scenery";

/** A linen panel follows three spars, with the canvas bowed forward between them. */
function sailcloth(y: number, height: number, width: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 4, 2);
  const pos = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    pos.setXYZ(i, .09 + u * (width + .04 * v), y + height * (v - .5) + .08 * u,
      .048 + .085 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - .075 * u);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function buildWindmill() {
  const tower = new THREE.Group();
  function paint(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geometry, clay(color));
    mesh.position.set(x, y, z);
    tower.add(mesh);
    return mesh;
  }
  const shell = new THREE.LatheGeometry([
    [1.46, 0], [1.46, .56], [1.38, .76], [1.18, 2.34], [.95, 3.57], [.94, 4.06],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  paint(shell, 0xf3dec2, 0, 0, 0);
  paint(new THREE.CylinderGeometry(1.41, 1.48, .56, 16), 0x909d97, 0, .28, 0);
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 19; k++) {
      const a = (k + row * .5) * Math.PI * 2 / 19;
      const radius = 1.448 - row * .022;
      const stone = paint(new THREE.BoxGeometry(.43, .15, .046), [0xb9bbaa,0xa8b2a7,0xc5c5b0][(k + row) % 3],
        Math.sin(a)*radius, .10 + row*.18, Math.cos(a)*radius);
      stone.rotation.y = a;
    }
  }
  // A flared copper cap and the narrower lantern break up the tapered silhouette.
  const roof = new THREE.LatheGeometry([
    [1.31, 3.86], [1.43, 3.98], [1.23, 4.10], [1.10, 4.46], [.77, 4.79], [.32, 5.09],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  paint(roof, 0x47797b, 0, 0, 0);
  for (const [r, y] of [[1.42,3.98],[1.11,4.46],[.78,4.79]]) {
    paint(new THREE.CylinderGeometry(r, r, .055, 16), 0x638985, 0, y, 0);
  }
  paint(new THREE.CylinderGeometry(.24,.34,.32,8),0xe5bc79,0,5.16,0);
  paint(new THREE.ConeGeometry(.39,.41,8),0x42676c,0,5.51,0);
  paint(new THREE.OctahedronGeometry(.105),0xe3ad62,0,5.76,0);

  const entry = new THREE.Shape();
  entry.moveTo(-.40, 0); entry.lineTo(.40, 0); entry.lineTo(.40, 1.12);
  entry.absarc(0, 1.12, .40, 0, Math.PI, false); entry.closePath();
  paint(new THREE.ExtrudeGeometry(entry, { depth: .08, bevelEnabled: false, curveSegments: 8 }), 0x674d41, 0, .025, 1.37);
  for (let i = -2; i <= 2; i++) {
    const h = 1.05 + Math.sqrt(.34 ** 2 - (i * .14) ** 2);
    paint(new THREE.BoxGeometry(.129,h,.065),i % 2 ? 0x966e52 : 0xa17a58, i*.14, h*.5+.035, 1.466);
  }
  for (const y of [.42,.92]) paint(new THREE.BoxGeometry(.25,.043,.04),0x4b4941,-.20,y,1.51);
  paint(new THREE.SphereGeometry(.055,8,6),0xe6b76b,.19,.76,1.53);

  const window = (angle: number, y: number, radius: number, width: number) => {
    const g = new THREE.Group(); g.position.set(Math.sin(angle)*radius,y,Math.cos(angle)*radius);
    g.rotation.y = angle;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(width,.62,.07),clay(0x58858b));
    g.add(pane);
    for (const side of [-1,1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(.065,.72,.11),clay(0x91694e));
      jamb.position.x = side*(width*.5+.018);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(width+.17,.07,.14),clay(0xf5e2bf));
      sill.position.y = side*.33; g.add(jamb,sill);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(width,.034,.09),clay(0xf2d8af));
    const muntin = new THREE.Mesh(new THREE.BoxGeometry(.033,.61,.09),clay(0xf2d8af));
    g.add(cross,muntin);tower.add(g);
  };
  for (const angle of [-1.3,.42,1.9,3.1]) window(angle,1.60,1.31,.40);
  for (const angle of [-1.63,.02,1.63,3.16]) window(angle,3.36,1.01,.38);

  // Cantilevered maintenance gallery at the base of the mill cap.
  paint(new THREE.CylinderGeometry(1.59,1.52,.15,12),0x9d7458,0,2.50,0);
  for (let k = 0; k < 12; k++) {
    const a = k*Math.PI/6, next = (k+1)*Math.PI/6, mid = (a+next)*.5;
    const x = 1.49 * Math.sin(a), z = 1.49 * Math.cos(a);
    paint(new THREE.BoxGeometry(.072,.53,.072),0xc5a87f,x,2.82,z);
    for (const h of [2.75,3.06]) {
      const rail = paint(new THREE.BoxGeometry(.79,.046,.052),0x735b4c,
        1.445*Math.sin(mid),h,1.445*Math.cos(mid));
      rail.rotation.y = mid;
    }
    const brace = paint(new THREE.BoxGeometry(.068,.49,.072),0x8c7056,x*.92,2.29,z*.92);
    brace.rotation.order = "YXZ"; brace.rotation.y=a;brace.rotation.x=.48;
  }

  const sails = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = k * Math.PI / 2;
    for (const [x, w, h, y] of [[0,.10,2.65,1.30],[.56,.046,2.07,1.59]]) {
      const spar = new THREE.Mesh(new THREE.BoxGeometry(w,h,.085), clay(0x80583e));
      spar.position.set(x,y,0); arm.add(spar);
    }
    for (let row = 0; row < 8; row++) {
      const y = .68 + row*.265;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(.66,.039,.081), clay(0xbc9060));
      rib.position.set(.27,y,0);arm.add(rib);
      if (row > 0 && row !== 4) {
        const cloth = new THREE.Mesh(sailcloth(y-.131,.25,.48), clay(row === 6 ? 0xbc795e : 0xf3dfba, { side: THREE.DoubleSide }));
        arm.add(cloth);
        // The reverse face is visible through the lattice when orbiting behind the mill.
        const back = cloth.clone();
        back.geometry = cloth.geometry.clone();
        const index = back.geometry.index!;
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);
        }
        back.geometry.computeVertexNormals();
        arm.add(back);
      }
    }
    sails.add(arm);
  }
  for (const [r,z,color] of [[.29,.02,0x795d47],[.21,.13,0xc09760],[.12,.23,0x827565]]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r,r,.11,12),clay(color));
    hub.rotation.x=Math.PI/2;hub.position.z=z;sails.add(hub);
  }
  const rotor = bakeScenery(sails);
  rotor.position.set(0,4.19,1.64);
  rotor.rotation.z = -.22;
  const group = new THREE.Group();
  group.add(bakeScenery(tower),rotor);
  group.scale.setScalar(1.12);
  return { group, rotor };
}
