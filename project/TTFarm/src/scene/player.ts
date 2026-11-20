import * as THREE from "three";
import type { AvatarId, OutfitId } from "../game/appearance";
import { walkingRoute } from "../game/walkingRoute";
import type { AvatarMotion, AvatarRig } from "./rig";
import { builtinModelUrl, getCustomModel, onCustomModelChange } from "./avatarModel";
import { createFieldAvatar } from "./fieldAvatar";
import { advanceBridge, sampleTravelSurface } from "../game/waterTravel";
import type { WorldObstacles } from "./obstacles";
import { riverBedHeight, riverInfo } from "./layout";

function waterFloorAt(x: number, z: number) {
  return riverBedHeight(riverInfo(x, z).dist);
}

export class Player {
  readonly root = new THREE.Group();
  private rig: AvatarRig;
  private avatarId: AvatarId;
  private outfitId: OutfitId;
  private bottomId: OutfitId;
  // 出生点在草台最前排田外的那条走道上，正对整片田，第一排地块不会被挡住
  private position = new THREE.Vector3(0, 0, 6.9);
  private readonly previous = new THREE.Vector3();
  private onDeck = false;
  private target: THREE.Vector3 | null = null;
  private waypoints: THREE.Vector3[] = [];
  private onArrive: (() => void) | null = null;
  private facing = Math.PI;
  private speed = 0;
  private moving = false;
  private readonly direction = new THREE.Vector3();
  private jumpHeight = 0;
  private jumpTime = -1;
  private motion: AvatarMotion = {
    phase: 0, moving: 0, running: 0, jumpPhase: 0, jumpWeight: 0, swimming: 0, swimPhase: 0,
  };
  private static readonly WALK_SPEED = 1.24;
  private static readonly RUN_SPEED = 2.75;
  /** 脚下地面高度：田埂草台和地块都是抬起来的，人物要跟着抬起来 */
  private groundY = 0;
  private cameraFloorY = 0;
  /** 异步加载模型的令牌：换形象/导入新模型时旧请求作废 */
  private modelToken = 0;
  private offCustomModel: () => void;

  constructor(avatarId: AvatarId, private readonly obstacles: WorldObstacles,
              private readonly fieldHeightAt: (x: number, z: number) => number,
              outfitId: OutfitId = "field", bottomId: OutfitId = outfitId) {
    this.avatarId = avatarId;
    this.outfitId = outfitId;
    this.bottomId = bottomId;
    this.rig = createFieldAvatar(avatarId,outfitId,bottomId);
    this.root.add(this.rig.visual);
    this.groundY = this.cameraFloorY = fieldHeightAt(this.position.x, this.position.z);
    this.root.position.set(this.position.x, this.groundY, this.position.z);
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

  get onBridgeDeck() { return this.onDeck; }
  get swimAmount() { return this.motion.swimming; }
  get cameraGroundY() { return this.cameraFloorY; }

  setAvatar(avatarId: AvatarId): void {
    this.setAppearance(avatarId, this.outfitId, this.bottomId);
  }

  setAppearance(avatarId: AvatarId, outfitId: OutfitId, bottomId: OutfitId = outfitId): void {
    if (avatarId === this.avatarId && outfitId === this.outfitId && bottomId === this.bottomId) return;
    this.avatarId = avatarId;
    this.outfitId = outfitId;
    this.bottomId = bottomId;
    if (getCustomModel().url) return;
    if (this.rig.setAppearance) this.rig.setAppearance(avatarId, outfitId, bottomId);
    else {
      this.applyRig(createFieldAvatar(avatarId, outfitId, bottomId));
      void this.loadModelFor(avatarId);
    }
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
   * 加载失败时保留当前角色，不打断游戏。
   */
  private async loadModelFor(avatarId: AvatarId): Promise<void> {
    const token = ++this.modelToken;
    const custom = getCustomModel().url;
    const url = custom ?? builtinModelUrl(avatarId);
    if (!url) return;
    try {
      // VRM 运行库单独成块：不用 VRM 形象时不下载这 ~220KB
      const { loadVrmRig } = await import("./vrmAvatar");
      const outfit = this.outfitId, bottom = this.bottomId;
      const rig = await loadVrmRig(url, custom === null, avatarId, outfit, bottom);
      if (token !== this.modelToken) {
        rig.dispose();
        return;
      }
      if (this.avatarId !== avatarId || this.outfitId !== outfit || this.bottomId !== bottom)
        rig.setAppearance?.(this.avatarId, this.outfitId, this.bottomId);
      this.applyRig(rig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[avatar] VRM 加载失败，保留当前角色", url, message);
    }
  }

  dispose(): void {
    this.modelToken++;
    this.offCustomModel();
    this.root.remove(this.rig.visual);
    this.rig.dispose();
  }

  moveTo(point: THREE.Vector3, onArrive?: () => void, targetDeck = false): void {
    this.waypoints = walkingRoute(this.position, point, this.obstacles, this.onDeck, targetDeck);
    this.target = this.waypoints.shift() ?? null;
    this.onArrive = this.target ? onArrive ?? null : null;
  }

  cancelTarget(): void {
    this.target = null;
    this.waypoints.length = 0;
    this.onArrive = null;
  }

  /** 键盘/虚拟摇杆输入：直接位移，并取消点选目标 */
  private applyFacing(dir: THREE.Vector3, dt: number): number {
    const targetFacing = Math.atan2(dir.x, dir.z);
    const diff =
      THREE.MathUtils.euclideanModulo(targetFacing - this.facing + Math.PI, Math.PI * 2) - Math.PI;
    const turn = THREE.MathUtils.clamp(diff * (1 - Math.exp(-13 * dt)), -9 * dt, 9 * dt);
    this.facing += turn;
    return Math.abs(diff - turn);
  }

  jump(): void {
    if (this.jumpTime < 0 && this.swimAmount < 0.35) this.jumpTime = 0;
  }

  update(dt: number, t: number, inputDir: THREE.Vector3 | null, running = false): void {
    const dir = this.direction;
    let strength = 0;
    let distanceLeft = Infinity;
    if (inputDir && inputDir.lengthSq() > 0.0001) {
      this.cancelTarget();
      dir.set(inputDir.x, 0, inputDir.z);
      strength = Math.min(1, dir.length());
    } else if (this.target) {
      dir.subVectors(this.target, this.position);
      dir.y = 0;
      distanceLeft = dir.length();
      strength = 1;
    }
    const maxSpeed = THREE.MathUtils.lerp(running ? Player.RUN_SPEED : Player.WALK_SPEED,
      running ? 1.45 : 0.94, this.swimAmount);
    const lastFacing = this.facing;
    const remainingTurn = strength > 0 ? this.applyFacing(dir, dt) : 0;
    const alignment = THREE.MathUtils.lerp(Math.max(0, Math.cos(remainingTurn)), 1, this.swimAmount);
    const previousSpeed = this.speed;
    const stoppingSpeed = this.target && this.waypoints.length === 0 ? Math.sqrt(2 * 18 * distanceLeft) : Infinity;
    const goalSpeed = Math.min(strength * maxSpeed * alignment, stoppingSpeed);
    if (strength > 0) this.speed = THREE.MathUtils.damp(previousSpeed, goalSpeed, 16, dt);
    else this.speed = Math.max(0, previousSpeed - 18 * dt) * (1 - this.swimAmount);
    const speedForStep = strength === 0 && this.swimAmount === 1 ? 0 : (previousSpeed + this.speed) * 0.5;

    this.previous.copy(this.position);
    if (speedForStep > 0) {
      if (this.target || (strength > 0 && this.swimAmount >= 0.5)) dir.normalize();
      else dir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.position.addScaledVector(dir, Math.min(distanceLeft, speedForStep * dt));
      this.obstacles.move(this.previous, this.position, this.onDeck ? "deck" : "terrain");
      this.onDeck = advanceBridge(this.previous.x, this.previous.z, this.position, this.onDeck);
    }
    const distance = this.position.distanceTo(this.previous);
    this.moving = distance > 0.0001;
    if (this.target && Math.hypot(this.position.x - this.target.x, this.position.z - this.target.z) < 0.001) {
      this.target = this.waypoints.shift() ?? null;
      if (!this.target) {
        this.speed = 0;
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
    }

    const motion = this.motion;
    const turnRate = dt > 0 ? (this.facing - lastFacing) / dt : 0;
    motion.turn = THREE.MathUtils.damp(motion.turn ?? 0, THREE.MathUtils.clamp(turnRate / 6, -1, 1), 13, dt);
    const surface = sampleTravelSurface(this.position.x, this.position.z, this.onDeck, this.fieldHeightAt);
    motion.swimming = THREE.MathUtils.smoothstep(surface.depth, 0.52, 1.00);
    motion.waterFloor = surface.depth > 0 ? waterFloorAt : undefined;
    this.cameraFloorY = Math.max(surface.floorY, surface.waterY);
    const speed = dt > 0 ? distance / dt : 0;
    if (motion.swimming > 0) {
      motion.swimPhase = (motion.swimPhase + dt * 0.48 + distance * 0.33) % 1;
    }
    if (motion.swimming >= 0.75 && this.jumpTime >= 0) {
      this.jumpTime = -1;
      this.jumpHeight = 0;
      motion.jumpWeight = 0;
    }
    motion.running = THREE.MathUtils.damp(motion.running,
      THREE.MathUtils.smoothstep(speed, Player.WALK_SPEED, Player.RUN_SPEED), 12, dt);
    motion.moving = THREE.MathUtils.damp(motion.moving, Math.min(1, speed / 0.85), 20, dt);
    // Blending toward idle shortens each planted leg's backward sweep. Shorten
    // the distance per cycle by the same proportion for analog steps.
    const stride = THREE.MathUtils.lerp(1.09, 1.66, motion.running) * Math.max(0.16, motion.moving);
    motion.phase = (motion.phase + distance / stride) % 1;

    // Capture frames 32–108 gather and extend, 108–178 are airborne,
    // then 178–248 absorb impact and recover. The parabola starts at toe-off.
    if (this.jumpTime >= 0) {
      this.jumpTime += dt;
      const prepare = 0.24, flight = 0.58, settle = 0.40;
      const t = this.jumpTime, landing = prepare + flight, end = landing + settle;
      const air = THREE.MathUtils.clamp((t - prepare) / flight, 0, 1);
      const frame = t < prepare ? 32 + 76 * (t / prepare)
        : t < landing ? 108 + 70 * air
        : 178 + 70 * Math.min(1, (t - landing) / settle);
      motion.jumpPhase = (frame - 32) / 216;
      motion.jumpWeight = THREE.MathUtils.smoothstep(t, 0, 0.11)
        * (1 - THREE.MathUtils.smoothstep(t, landing + 0.14, end));
      this.jumpHeight = 4 * 0.42 * air * (1 - air);
      if (t >= end) this.jumpTime = -1;
    }
    const support = THREE.MathUtils.lerp(surface.floorY, surface.waterY, motion.swimming);
    this.groundY = THREE.MathUtils.damp(this.groundY, support, 16, dt);
    this.root.position.set(this.position.x, this.groundY + this.jumpHeight * (1 - motion.swimming), this.position.z);
    this.root.rotation.y = this.facing;
    this.rig.animate?.(dt, t, motion);
  }
}
