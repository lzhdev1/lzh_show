import type * as THREE from "three";

export interface AvatarRig {
  visual: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  animate?: (dt: number, t: number, moving: boolean, phase: number) => void;
  /** true 表示这套骨架自己管四肢姿态（VRM 用），Player 不再直接改四肢旋转 */
  selfAnimated?: boolean;
  dispose: () => void;
}
