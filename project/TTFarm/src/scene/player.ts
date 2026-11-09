import * as THREE from "three";
import type { AvatarId } from "../game/state";
import type { AvatarRig } from "./rig";
import { builtinModelUrl, getCustomModel, onCustomModelChange } from "./avatarModel";

(window as unknown as { __ttfarmPlayerModule?: string }).__ttfarmPlayerModule = "v4";

/**
 * VRM 模型到位之前的占位骨架：只保留一团接触阴影，避免角色加载期间
 * 地上空无一物、也避免闪出一个和最终形象完全不同的低模小人。
 */
function buildPlaceholderRig(): AvatarRig {
  const visual = new THREE.Group();
  const body = new THREE.Group();
  visual.add(body);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 24),
    new THREE.MeshBasicMaterial({
      color: 0x2c2a22,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  visual.add(blob);

  const empty = () => new THREE.Object3D();

  const dispose = () => {
    blob.geometry.dispose();
    (blob.material as THREE.Material).dispose();
  };

  return {
    visual,
    body,
    head: empty(),
    leftLeg: empty(),
    rightLeg: empty(),
    leftArm: empty(),
    rightArm: empty(),
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
  /** 脚下地面高度：田埂草台和地块都是抬起来的，人物要跟着抬起来 */
  private groundY = 0;
  private groundTarget = 0;
  /** 异步加载模型的令牌：换形象/导入新模型时旧请求作废 */
  private modelToken = 0;
  private offCustomModel: () => void;

  constructor(avatarId: AvatarId) {
    this.avatarId = avatarId;
    this.rig = buildPlaceholderRig();
    this.root.add(this.rig.visual);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

    // 资料面板导入本地 VRM 时，立即替换当前形象
    this.offCustomModel = onCustomModelChange(() => {
      void this.loadModelFor(this.avatarId);
    });
    void this.loadModelFor(avatarId);
  }

  get positionRef(): THREE.Vector3 {
    return this.position;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  setAvatar(avatarId: AvatarId): void {
    if (avatarId === this.avatarId) return;
    this.avatarId = avatarId;
    void this.loadModelFor(avatarId);
  }

  /** 换上一套新骨架，并释放旧的那套 */
  private applyRig(rig: AvatarRig): void {
    this.root.remove(this.rig.visual);
    this.rig.dispose();
    this.rig = rig;
    this.root.add(rig.visual);
  }

  /**
   * 优先用本地导入的 VRM，其次用内置形象配置的 VRM 文件。
   * 加载失败时保留占位骨架，不打断游戏。
   */
  private async loadModelFor(avatarId: AvatarId): Promise<void> {
    const token = ++this.modelToken;
    const custom = getCustomModel().url;
    const url = custom ?? builtinModelUrl(avatarId);
    if (!url) return;
    try {
      // VRM 运行库单独成块：不用 VRM 形象时不下载这 ~220KB
      (window as unknown as { __ttfarmVrmState?: string }).__ttfarmVrmState = `loading ${url}`;
      const { loadVrmRig } = await import("./vrmAvatar");
      const rig = await loadVrmRig(url);
      if (token !== this.modelToken) {
        rig.dispose();
        return;
      }
      this.applyRig(rig);
      // 便于排查"到底用的哪套模型"，不影响游戏逻辑
      (window as unknown as { __ttfarmAvatar?: string }).__ttfarmAvatar = "vrm";
      document.body.dataset.avatarModel = "vrm";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      (window as unknown as { __ttfarmVrmState?: string }).__ttfarmVrmState = `failed: ${message}`;
      document.body.dataset.avatarModel = `failed: ${message}`;
      console.warn("[avatar] VRM 加载失败，保留占位骨架：", url, err);
    }
  }

  dispose(): void {
    this.offCustomModel();
    this.root.remove(this.rig.visual);
    this.rig.dispose();
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
    // 正面围栏留了门：只有站在门口这条走廊里，z 才允许越过围栏走到外面
    const nearGate = Math.abs(this.position.x) <= 1.2;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -5.8, 5.8);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -7.4, nearGate ? 16 : 7.2);
    if (this.position.z > 7.2) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, -1.15, 1.15);
    }
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
    if (!this.rig.selfAnimated) {
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.leftArm.rotation.x = -swing * 0.7;
      this.rig.rightArm.rotation.x = swing * 0.7;
    }
    this.rig.visual.position.y = this.moving
      ? Math.abs(Math.sin(this.walkPhase)) * 0.04
      : Math.sin(t * 1.6) * 0.012;
    this.rig.body.rotation.z = this.moving ? Math.sin(this.walkPhase) * 0.03 : 0;
    this.rig.animate?.(dt, t, this.moving, this.walkPhase);

    // 上下台阶：往目标高度插值，避免走到地块上时整个人瞬移
    this.groundY = THREE.MathUtils.damp(this.groundY, this.groundTarget, 12, dt);

    this.root.position.set(this.position.x, this.groundY, this.position.z);
    this.root.rotation.y = this.facing;
  }

  /** 由场景每帧告诉人物脚下多高，人物平滑抬到地面高度 */
  setGroundTarget(y: number): void {
    this.groundTarget = y;
  }
}
