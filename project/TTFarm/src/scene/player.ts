import * as THREE from "three";
import type { AvatarId } from "../game/state";
import { buildGirlRig, type AvatarRig } from "./character";

interface Palette {
  skin: number;
  shirt: number;
  torso: number;
  pants: number;
  hair: number;
  accent: number;
}

const PALETTES: Record<AvatarId, Palette> = {
  ahae: { skin: 0xf1c6a0, shirt: 0xece3cc, torso: 0x4f8f3f, pants: 0x3f7440, hair: 0x6b4a2f, accent: 0x4f8f3f },
  xiaosui: { skin: 0xf5cda9, shirt: 0x86bcdd, torso: 0x86bcdd, pants: 0x5f7f9c, hair: 0x6b4a2f, accent: 0xe8863c },
  heshu: { skin: 0xe8b389, shirt: 0xe3ddc9, torso: 0x2f577f, pants: 0x3f6fa8, hair: 0x4a3423, accent: 0x2f577f },
  xiaodou: { skin: 0xf3c9a4, shirt: 0x7a5bbd, torso: 0x7a5bbd, pants: 0x3a3a4a, hair: 0x22222a, accent: 0x5b3f96 },
};

function capsule(radius: number, length: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 4, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true })
  );
  mesh.castShadow = true;
  return mesh;
}

function buildRig(avatarId: AvatarId): AvatarRig {
  // 「小穗」用贴图少女模型，其余三套先沿用程序化低模
  return avatarId === "xiaosui" ? buildGirlRig() : buildAvatar(avatarId);
}

function buildAvatar(avatarId: AvatarId): AvatarRig {
  const palette = PALETTES[avatarId];
  const visual = new THREE.Group();
  const owned: Array<THREE.BufferGeometry | THREE.Material> = [];

  const track = (mesh: THREE.Mesh) => {
    owned.push(mesh.geometry);
    if (mesh.material instanceof THREE.Material) owned.push(mesh.material);
    return mesh;
  };

  const body = track(capsule(0.25, 0.36, palette.torso));
  body.position.y = 0.86;
  visual.add(body);

  const head = track(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 16, 14),
      new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.9, metalness: 0 })
    )
  );
  head.position.y = 1.44;
  visual.add(head);

  // 头发
  const hair = track(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.245, 14, 12),
      new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.95, metalness: 0, flatShading: true })
    )
  );
  hair.position.set(0, 1.5, -0.01);
  hair.scale.set(1, 0.72, 1);
  visual.add(hair);

  // 眼睛与嘴
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.5 });
  owned.push(eyeMat);
  [-0.085, 0.085].forEach((x) => {
    const eye = track(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat));
    eye.position.set(x, 1.47, 0.195);
    visual.add(eye);
  });
  const mouth = track(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.03), eyeMat));
  mouth.position.set(0, 1.37, 0.21);
  visual.add(mouth);

  const legs: THREE.Mesh[] = [];
  [-0.12, 0.12].forEach((x) => {
    const leg = track(capsule(0.1, 0.22, palette.pants));
    leg.position.set(x, 0.22, 0);
    visual.add(leg);
    legs.push(leg);
  });

  const arms: THREE.Mesh[] = [];
  [-0.31, 0.31].forEach((x) => {
    const arm = track(capsule(0.075, 0.28, palette.shirt));
    arm.position.set(x, 0.98, 0);
    arm.rotation.z = x > 0 ? -0.16 : 0.16;
    visual.add(arm);
    arms.push(arm);
  });

  // 形象差异：草帽 / 头巾 / 猫耳兜帽 / 围裙
  if (avatarId === "ahae" || avatarId === "heshu") {
    const straw = 0xd7b171;
    const brim = track(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.46, 0.045, 14),
        new THREE.MeshStandardMaterial({ color: straw, roughness: 0.95, metalness: 0, flatShading: true })
      )
    );
    brim.position.y = 1.63;
    visual.add(brim);
    const crown = track(
      new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.3, 10),
        new THREE.MeshStandardMaterial({ color: straw, roughness: 0.95, metalness: 0, flatShading: true })
      )
    );
    crown.position.y = 1.79;
    visual.add(crown);
  }

  if (avatarId === "xiaosui") {
    const scarf = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.248, 14, 10),
        new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.9, metalness: 0, flatShading: true })
      )
    );
    scarf.position.set(0, 1.56, -0.01);
    scarf.scale.set(1.06, 0.62, 1.06);
    visual.add(scarf);

    [-0.26, 0.26].forEach((x) => {
      const tail = track(capsule(0.075, 0.24, palette.hair));
      tail.position.set(x, 1.3, -0.06);
      tail.rotation.z = x > 0 ? 0.24 : -0.24;
      visual.add(tail);
    });

    const apron = track(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.5, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xf2e7d3, roughness: 0.9, metalness: 0 })
      )
    );
    apron.position.set(0, 0.78, 0.24);
    visual.add(apron);
  }

  if (avatarId === "xiaodou") {
    const hood = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 14, 12),
        new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.9, metalness: 0, flatShading: true })
      )
    );
    hood.position.set(0, 1.52, -0.02);
    hood.scale.set(1.02, 0.78, 1.04);
    visual.add(hood);

    [-0.18, 0.18].forEach((x) => {
      const ear = track(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), hood.material as THREE.Material));
      ear.position.set(x, 1.74, 0.01);
      ear.rotation.z = x > 0 ? -0.3 : 0.3;
      visual.add(ear);
    });
  }

  if (avatarId === "ahae") {
    const bib = track(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.32, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x5f9c47, roughness: 0.9, metalness: 0 })
      )
    );
    bib.position.set(0, 0.9, 0.23);
    visual.add(bib);
  }

  if (avatarId === "heshu") {
    const beard = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.95, metalness: 0, flatShading: true })
      )
    );
    beard.position.set(0, 1.3, 0.12);
    beard.scale.set(1, 0.78, 0.7);
    visual.add(beard);
  }

  // 脚下接触阴影：让角色不飘
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 24),
    new THREE.MeshBasicMaterial({ color: 0x2c2a22, transparent: true, opacity: 0.22, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  visual.add(blob);
  owned.push(blob.geometry, blob.material as THREE.Material);

  const dispose = () => {
    owned.forEach((item) => item.dispose());
  };

  visual.scale.setScalar(1.12);

  return {
    visual,
    body,
    head,
    leftLeg: legs[0],
    rightLeg: legs[1],
    leftArm: arms[0],
    rightArm: arms[1],
    dispose,
  };
}

export class Player {
  readonly root = new THREE.Group();
  private rig: AvatarRig;
  private avatarId: AvatarId;
  private position = new THREE.Vector3(0, 0, 6.1);
  private target: THREE.Vector3 | null = null;
  private onArrive: (() => void) | null = null;
  private facing = Math.PI;
  private walkPhase = 0;
  private moving = false;

  constructor(avatarId: AvatarId) {
    this.avatarId = avatarId;
    this.rig = buildRig(avatarId);
    this.root.add(this.rig.visual);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;
  }

  get positionRef(): THREE.Vector3 {
    return this.position;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  setAvatar(avatarId: AvatarId): void {
    if (avatarId === this.avatarId) return;
    this.root.remove(this.rig.visual);
    this.rig.dispose();
    this.avatarId = avatarId;
    this.rig = buildRig(avatarId);
    this.root.add(this.rig.visual);
  }

  moveTo(point: THREE.Vector3, onArrive?: () => void): void {
    this.target = point.clone();
    this.onArrive = onArrive ?? null;
    this.moving = true;
  }

  cancelTarget(): void {
    this.target = null;
    this.onArrive = null;
  }

  /** 键盘/虚拟摇杆输入：直接位移，并取消点选目标 */
  private applyFacing(dir: THREE.Vector3, dt: number): void {
    const targetFacing = Math.atan2(dir.x, dir.z);
    const diff =
      THREE.MathUtils.euclideanModulo(targetFacing - this.facing + Math.PI, Math.PI * 2) - Math.PI;
    this.facing += diff * Math.min(1, dt * 9);
  }

  private clampPosition(): void {
    this.position.x = THREE.MathUtils.clamp(this.position.x, -5.8, 5.8);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -7.4, 7.4);
  }

  update(dt: number, t: number, inputDir: THREE.Vector3 | null): void {
    const hasInput = !!inputDir && inputDir.lengthSq() > 0.0001;

    if (hasInput) {
      this.cancelTarget();
      const dir = inputDir!.clone();
      dir.y = 0;
      dir.normalize();
      this.position.addScaledVector(dir, 3.1 * dt);
      this.clampPosition();
      this.applyFacing(dir, dt);
      this.moving = true;
    } else if (this.target) {
      const to = this.target.clone().sub(this.position);
      to.y = 0;
      const dist = to.length();
      if (dist <= 0.14) {
        this.position.copy(this.target);
        this.target = null;
        this.moving = false;
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        const dir = to.normalize();
        const stepSize = Math.min(3.1 * dt, dist);
        this.position.addScaledVector(dir, stepSize);
        this.clampPosition();
        this.applyFacing(dir, dt);
        this.moving = true;
      }
    } else {
      this.moving = false;
    }

    if (this.moving) {
      this.walkPhase += dt * 9.5;
    } else {
      this.walkPhase += dt * 1.2;
    }

    const swing = this.moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.rig.leftLeg.rotation.x = swing;
    this.rig.rightLeg.rotation.x = -swing;
    this.rig.leftArm.rotation.x = -swing * 0.7;
    this.rig.rightArm.rotation.x = swing * 0.7;
    this.rig.visual.position.y = this.moving
      ? Math.abs(Math.sin(this.walkPhase)) * 0.04
      : Math.sin(t * 1.6) * 0.012;
    this.rig.body.rotation.z = this.moving ? Math.sin(this.walkPhase) * 0.03 : 0;
    this.rig.animate?.(dt, t, this.moving, this.walkPhase);

    this.root.position.set(this.position.x, 0, this.position.z);
    this.root.rotation.y = this.facing;
  }
}
