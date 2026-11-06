import * as THREE from "three";
import { CROPS, type CropId } from "../game/crops";

export interface CropModel {
  group: THREE.Group;
  /** 按阶段显隐 + 轻微摆动；stage 0–3 */
  sync: (stage: number, t: number) => void;
  dispose: () => void;
}

interface Part {
  mesh: THREE.Mesh;
  /** 从哪个阶段开始可见 */
  from: number;
}

export function createCropModel(crop: CropId): CropModel {
  const def = CROPS[crop];
  const group = new THREE.Group();
  const parts: Part[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const materialCache = new Map<number, THREE.MeshStandardMaterial>();

  const getMat = (color: number) => {
    let m = materialCache.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
      });
      materialCache.set(color, m);
      materials.push(m);
    }
    return m;
  };

  const add = (
    geo: THREE.BufferGeometry,
    color: number,
    from: number,
    pos: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number]
  ) => {
    const mesh = new THREE.Mesh(geo, getMat(color));
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.userData.stage = from;
    mesh.visible = from === 0;
    group.add(mesh);
    parts.push({ mesh, from });
    return mesh;
  };

  const soil = 0x9a6b47;

  // 每个作物都从一小撮土开始
  add(new THREE.SphereGeometry(0.19, 8, 6), soil, 0, [0, 0.05, 0], [0, 0, 0], [1, 0.45, 1]);

  if (crop === "radish") {
    [-1, 1].forEach((dir) =>
      add(new THREE.ConeGeometry(0.085, 0.3, 5), def.leaf, 1, [dir * 0.1, 0.2, 0], [0, 0, dir * 0.32], [1, 1, 1])
    );
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.11, 0.46, 5),
        def.leaf,
        2,
        [Math.cos(a) * 0.16, 0.3, Math.sin(a) * 0.16],
        [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]
      );
    }
    add(new THREE.SphereGeometry(0.2, 10, 8), def.body, 3, [0, 0.19, 0], [0, 0, 0], [1, 1.05, 1]);
    add(new THREE.SphereGeometry(0.07, 8, 6), 0xfdf6ec, 3, [0, 0.06, 0]);
  }

  if (crop === "cabbage") {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.15, 8, 6), def.leaf, 1, [Math.cos(a) * 0.11, 0.13, Math.sin(a) * 0.11]);
    }
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      add(
        new THREE.SphereGeometry(0.19, 9, 7),
        def.leaf,
        2,
        [Math.cos(a) * 0.19, 0.2, Math.sin(a) * 0.19],
        [0, 0, 0],
        [1, 0.85, 1]
      );
    }
    add(new THREE.SphereGeometry(0.33, 12, 10), def.body, 3, [0, 0.38, 0], [0, 0, 0], [1, 0.92, 1]);
  }

  if (crop === "tomato") {
    add(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 6), 0x6b8f3f, 1, [0, 0.25, 0]);
    [-1, 1].forEach((dir) =>
      add(new THREE.ConeGeometry(0.09, 0.26, 5), def.leaf, 1, [dir * 0.14, 0.36, 0.02], [0, 0, dir * 1.1])
    );
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 5), 0xb58a5c, 2, [0.13, 0.5, 0.06]);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.1, 0.34, 5),
        def.leaf,
        2,
        [Math.cos(a) * 0.2, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.2],
        [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]
      );
    }
    const fruits: Array<[number, number, number]> = [
      [0.18, 0.44, 0.1],
      [-0.13, 0.52, 0.14],
      [0.05, 0.62, -0.19],
    ];
    fruits.forEach((p) => {
      add(new THREE.SphereGeometry(0.13, 9, 8), def.body, 3, p);
      add(new THREE.ConeGeometry(0.1, 0.06, 5), def.leaf, 3, [p[0], p[1] + 0.12, p[2]]);
    });
  }

  if (crop === "corn") {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.07, 0.62, 4),
        def.leaf,
        1,
        [Math.cos(a) * 0.08, 0.34, Math.sin(a) * 0.08],
        [Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24]
      );
    }
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.86, 6), 0x7fa34a, 2, [0, 0.45, 0]);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      add(
        new THREE.ConeGeometry(0.08, 0.72, 4),
        def.leaf,
        2,
        [Math.cos(a) * 0.12, 0.5, Math.sin(a) * 0.12],
        [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]
      );
    }
    add(new THREE.CylinderGeometry(0.09, 0.1, 0.42, 8), def.body, 3, [0.1, 0.62, 0.06], [0, 0, -0.2]);
  }

  if (crop === "strawberry") {
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.1, 0.24, 5),
        def.leaf,
        1,
        [Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15],
        [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1]
      );
    }
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.09, 0.28, 5),
        def.leaf,
        2,
        [Math.cos(a) * 0.24, 0.16, Math.sin(a) * 0.24],
        [Math.sin(a) * 1.35, 0, -Math.cos(a) * 1.35]
      );
    }
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      add(new THREE.SphereGeometry(0.05, 7, 6), 0xfdf8e8, 2, [Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2]);
    }
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.1, 8, 7), def.body, 3, [Math.cos(a) * 0.22, 0.17, Math.sin(a) * 0.22], [0, 0, 0], [1, 0.85, 1]);
    }
  }

  if (crop === "pumpkin") {
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 5), 0x7d9a4a, 1, [0.16, 0.06, 0.1], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.12, 0.24, 5), def.leaf, 1, [Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]);
    }
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      add(new THREE.ConeGeometry(0.14, 0.32, 5), def.leaf, 2, [Math.cos(a) * 0.42, 0.14, Math.sin(a) * 0.42], [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4]);
    }
    add(new THREE.SphereGeometry(0.32, 12, 10), def.body, 3, [0, 0.26, 0], [0, 0, 0], [1, 0.78, 1]);
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 6), 0x6f7d3d, 3, [0, 0.52, -0.04]);
  }

  group.userData.phase = Math.random() * Math.PI * 2;

  const sync = (stage: number, t: number) => {
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      part.mesh.visible = stage >= part.from;
    }
    const phase = group.userData.phase as number;
    group.rotation.z = stage >= 1 ? Math.sin(t * 1.1 + phase) * 0.035 : 0;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    materials.forEach((m) => m.dispose());
  };

  return { group, sync, dispose };
}
