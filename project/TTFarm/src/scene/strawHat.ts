import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** 一张顶点色网格构成的草帽。尺寸按米，可随头骨一起缩放。 */
export function createStrawHat(): THREE.Mesh {
  const pieces: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  function add(geometry: THREE.BufferGeometry, hex: number) {
    const vertices = geometry.getAttribute("position").count;
    const colors = new Float32Array(vertices * 3);
    color.setHex(hex);
    for (let i = 0; i < vertices; i++) color.toArray(colors, i * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute("uv");
    pieces.push(geometry);
  }

  function weave(profile: number[][], hue: number) {
    const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const points = geometry.getAttribute("position");
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), z = points.getZ(i);
      const angle = Math.atan2(x, z);
      const edge = THREE.MathUtils.smoothstep(Math.hypot(x, z), 0.115, 0.225);
      points.setXYZ(i, x, points.getY(i) + edge * Math.sin(angle * 3 + 0.45) * 0.012, z * 0.94);
    }
    geometry.computeVertexNormals();
    add(geometry, hue);
  }

  // 双层弧形帽檐、圆冠和窄包边，从俯视和低机位看都有厚度。
  weave([[0.09, 0.008], [0.15, 0], [0.219, -0.022], [0.224, -0.018],
    [0.219, -0.012], [0.17, -0.001], [0.126, 0.012], [0.119, 0.055],
    [0.103, 0.089], [0.077, 0.105], [0.028, 0.105], [0, 0.102]], 0xdeb373);
  weave([[0.220, -0.021], [0.225, -0.019], [0.223, -0.015]], 0xb47e4b);
  weave([[0.127, 0.013], [0.124, 0.032], [0.1215, 0.039]], 0x34615b);
  weave([[0.1248, 0.029], [0.124, 0.033]], 0x90afa0);
  for (const [radius, height] of [[0.17, 0], [0.186, -0.004], [0.201, -0.008]]) {
    weave([[radius, height], [radius + 0.002, height - 0.0002]], 0xc69b60);
  }

  // 帽带上的小雏菊，朝上、向外微倾。
  const flower = new THREE.Matrix4().makeRotationZ(-0.7);
  flower.setPosition(0.112, 0.038, 0.044);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(1, 8, 5);
    petal.scale(0.008, 0.004, 0.015);
    petal.rotateY(a);
    petal.translate(0.012 * Math.sin(a), 0, 0.012 * Math.cos(a));
    add(petal.applyMatrix4(flower), 0xfff0c8);
  }
  const heart = new THREE.SphereGeometry(0.009, 8, 5).applyMatrix4(flower);
  add(heart, 0xe69b41);
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  const hat = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  }));
  hat.name = "xiaosui-straw-hat";
  hat.castShadow = true;
  return hat;
}
