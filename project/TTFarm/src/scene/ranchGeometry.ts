import * as THREE from "three";

const shapes = {
  egg: new THREE.SphereGeometry(1, 12, 9),
  pebble: new THREE.SphereGeometry(1, 8, 5),
  crystal: new THREE.OctahedronGeometry(1),
  horn: new THREE.ConeGeometry(1, 2, 7),
  pipe: new THREE.CylinderGeometry(1, 1, 2, 8),
  block: new THREE.BoxGeometry(2, 2, 2),
  loop: new THREE.TorusGeometry(1, 0.055, 4, 24),
};
type Shape = keyof typeof shapes;
export type XYZ = [number, number, number];

/** Bake small painted components into a single indexed mesh. Animated pieces have one rigid joint. */
export class RanchGeometry {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private joints: number[] = [];
  private lights: number[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly vertex = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly color = new THREE.Color();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly skinned = false) {}

  part(kind: Shape, at: XYZ, size: XYZ, hex: number, rotation: XYZ | THREE.Quaternion = [0,0,0], joint = 0, glow = 0) {
    const source = shapes[kind];
    const pos = source.attributes.position, norm = source.attributes.normal;
    const offset = this.positions.length / 3;
    this.color.setHex(hex);
    if (rotation instanceof THREE.Quaternion) this.rotation.copy(rotation);
    else this.rotation.setFromEuler(new THREE.Euler(...rotation));
    this.matrix.compose(new THREE.Vector3(...at), this.rotation, new THREE.Vector3(...size));
    this.normalMatrix.getNormalMatrix(this.matrix);
    for (let i = 0; i < pos.count; i++) {
      this.vertex.fromBufferAttribute(pos, i).applyMatrix4(this.matrix);
      this.positions.push(this.vertex.x, this.vertex.y, this.vertex.z);
      this.vertex.fromBufferAttribute(norm, i).applyNormalMatrix(this.normalMatrix);
      this.normals.push(this.vertex.x, this.vertex.y, this.vertex.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
      if (this.skinned) { this.joints.push(joint,0,0,0); this.lights.push(glow); }
    }
    const index = source.index;
    for (let i = 0; i < (index?.count ?? pos.count); i++) this.indices.push(offset + (index ? index.getX(i) : i));
  }

  beam(from: XYZ, to: XYZ, radius: number, hex: number, joint = 0, tapered = false, glow = 0) {
    const dir = new THREE.Vector3(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
    const length = dir.length();
    if (!length) return;
    const rotation = new THREE.Quaternion().setFromUnitVectors(this.up, dir.normalize());
    this.part(tapered ? "horn" : "pipe", [(to[0]+from[0])*.5,(to[1]+from[1])*.5,(to[2]+from[2])*.5],
      [radius, length*.5, radius], hex, rotation, joint, glow);
  }

  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    if (this.skinned) {
      geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.joints, 4));
      const weights = new Float32Array(this.joints.length);
      for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
      geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
      geometry.setAttribute("coatLight", new THREE.Float32BufferAttribute(this.lights, 1));
    }
    geometry.computeBoundingSphere();
    return geometry;
  }
}
