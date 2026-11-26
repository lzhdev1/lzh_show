import * as THREE from "three";
import type { AvatarId, OutfitId } from "../game/appearance";
import { HORSE_SPEED_FACTOR, isHorseSpecies, type AnimalSpecies } from "../game/ranch";
import { walkingRoute } from "../game/walkingRoute";
import type { ActionId, AvatarMotion, AvatarRig } from "./rig";
import { ACTIONS, actionWeight } from "./actionMotion";
import { builtinModelUrl, getCustomModel, onCustomModelChange } from "./avatarModel";
import { createFieldAvatar } from "./fieldAvatar";
import { advanceBridge, sampleTravelSurface } from "../game/waterTravel";
import type { WorldObstacles } from "./obstacles";
import { riverBedHeight, riverInfo } from "./layout";

const RIDING_SPEED_MULTIPLIER = 2.05;

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
  private runToTarget = false;
  private waypoints: THREE.Vector3[] = [];
  private onArrive: (() => void) | null = null;
  private facing = Math.PI;
  private speed = 0;
  private mountSpeedFactor = 1;
  private moving = false;
  private readonly direction = new THREE.Vector3();
  private jumpHeight = 0;
  /** 起跳瞬间脚下的地面高度；空中位移以它为基准，避免土丘升高时人陷进坡里 */
  private jumpBaseY = 0;
  private jumpTime = -1;
  private actionId: ActionId | null = null;
  private actionTime = 0;
  private motion: AvatarMotion = {
    phase: 0, moving: 0, running: 0, jumpPhase: 0, jumpWeight: 0, swimming: 0, swimPhase: 0,
  };
  private static readonly WALK_SPEED = 1.72;
  private static readonly RUN_SPEED = 3.82;
  /** 起跳抛物线的最高点；略微抬高，落地和原有动作帧仍由同一套时序控制。 */
  private static readonly JUMP_HEIGHT = 1.0;

  static maxMountedRunSpeed(species: AnimalSpecies) {
    return Player.RUN_SPEED * RIDING_SPEED_MULTIPLIER * (isHorseSpecies(species) ? HORSE_SPEED_FACTOR : 1);
  }
  /** 脚下地面高度：田埂草台和地块都是抬起来的，人物要跟着抬起来 */
  private groundY = 0;
  private cameraFloorY = 0;
  /** 异步加载模型的令牌：换形象/导入新模型时旧请求作废 */
  private modelToken = 0;
  private offCustomModel: () => void;

  constructor(avatarId: AvatarId, private readonly obstacles: WorldObstacles,
              private readonly fieldHeightAt: (x: number, z: number) => number,
              outfitId: OutfitId = "field", bottomId: OutfitId = outfitId, private readonly remote = false,
              private readonly detailed = true) {
    this.avatarId = avatarId;
    this.outfitId = outfitId;
    this.bottomId = bottomId;
    this.rig = createFieldAvatar(avatarId,outfitId,bottomId);
    this.root.add(this.rig.visual);
    this.groundY = this.cameraFloorY = fieldHeightAt(this.position.x, this.position.z);
    this.root.position.set(this.position.x, this.groundY, this.position.z);
    this.root.rotation.y = this.facing;

    // 资料面板导入本地 VRM 时，立即替换当前形象
    this.offCustomModel = remote ? () => {} : onCustomModelChange(() => {
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
  get isRunning() { return this.motion.running > 0.45 && this.moving; }
  get isJumping() { return this.jumpTime >= 0; }
  get currentAction() { return this.actionId; }
  get actionClock() { return this.actionTime; }

  /** 触发一个动作；骑乘、游泳、跳跃中不响应。移动会自动取消动作。 */
  playAction(id: ActionId): boolean {
    if (this.motion.saddleHeight || this.swimAmount > 0.35 || this.jumpTime >= 0) return false;
    this.cancelTarget();
    this.actionId = id;
    this.actionTime = 0;
    return true;
  }

  stopAction(): void {
    this.actionId = null;
  }

  relocate(x: number, z: number, yaw: number, onDeck = false): void {
    this.cancelTarget();
    this.position.set(x, 0, z);
    this.onDeck = onDeck;
    this.facing = yaw;
    this.speed = this.jumpHeight = 0;
    this.jumpTime = -1;
    this.actionId = null;
    this.moving = false;
    const surface = sampleTravelSurface(x, z, onDeck, this.fieldHeightAt);
    this.motion = { phase: 0, moving: 0, running: 0, jumpPhase: 0, jumpWeight: 0,
      swimming: THREE.MathUtils.smoothstep(surface.depth, 0.52, 1), swimPhase: 0 };
    this.cameraFloorY = Math.max(surface.floorY, surface.waterY);
    this.groundY = THREE.MathUtils.lerp(surface.floorY, surface.waterY, this.motion.swimming);
    this.root.position.set(x, this.groundY, z);
    this.root.rotation.y = yaw;
  }

  get onBridgeDeck() { return this.onDeck; }
  get isOnFoot() { return !this.motion.saddleHeight && !this.onDeck && this.jumpHeight === 0 && this.swimAmount === 0; }
  get swimAmount() { return this.motion.swimming; }
  get cameraGroundY() { return this.cameraFloorY; }
  setSaddleHeight(height: number, species?: AnimalSpecies) {
    const factor = height > 0 && species && isHorseSpecies(species) ? HORSE_SPEED_FACTOR : 1;
    this.speed *= factor / this.mountSpeedFactor;
    this.mountSpeedFactor = factor;
    this.motion.saddleHeight = height;
  }

  setAvatar(avatarId: AvatarId): void {
    this.setAppearance(avatarId, this.outfitId, this.bottomId);
  }

  setAppearance(avatarId: AvatarId, outfitId: OutfitId, bottomId: OutfitId = outfitId): void {
    if (avatarId === this.avatarId && outfitId === this.outfitId && bottomId === this.bottomId) return;
    this.avatarId = avatarId;
    this.outfitId = outfitId;
    this.bottomId = bottomId;
    if (!this.remote && getCustomModel().url) return;
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
    const custom = this.remote ? null : getCustomModel().url;
    const url = custom ?? builtinModelUrl(avatarId);
    if (!url || !this.detailed) return;
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

  animatePeer(dt: number, time: number, motion: AvatarMotion): void {
    this.rig.animate?.(dt, time, motion);
  }

  moveTo(point: THREE.Vector3, onArrive?: () => void, targetDeck = false, runToTarget = false): void {
    this.waypoints = walkingRoute(this.position, point, this.obstacles, this.onDeck, targetDeck);
    this.target = this.waypoints.shift() ?? null;
    this.runToTarget = runToTarget;
    this.onArrive = this.target ? onArrive ?? null : null;
  }

  cancelTarget(): void {
    this.target = null;
    this.waypoints.length = 0;
    this.onArrive = null;
  }

  /** Upgrading the ranch may place a new rail or stable divider under the rider. */
  adjustToChangedFences(): void {
    this.cancelTarget();
    const free = this.obstacles.project(this.position, this.onDeck ? "deck" : "terrain");
    this.position.x = this.root.position.x = free.x;
    this.position.z = this.root.position.z = free.z;
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
    if (this.jumpTime < 0 && this.swimAmount < 0.35) {
      this.jumpBaseY = this.groundY;
      this.jumpTime = 0;
      this.actionId = null;
    }
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
      running ||= this.runToTarget;
      dir.subVectors(this.target, this.position);
      dir.y = 0;
      distanceLeft = dir.length();
      strength = 1;
    }
    const riding = !!this.motion.saddleHeight;
    const gaitScale = riding ? RIDING_SPEED_MULTIPLIER * this.mountSpeedFactor : 1;
    const landSpeed = (running ? Player.RUN_SPEED : Player.WALK_SPEED) * gaitScale;
    const maxSpeed = THREE.MathUtils.lerp(landSpeed,
      running ? 1.45 : 0.94, this.swimAmount);
    const lastFacing = this.facing;
    const remainingTurn = strength > 0 ? this.applyFacing(dir, dt) : 0;
    const alignment = THREE.MathUtils.lerp(Math.max(0, Math.cos(remainingTurn)), 1, this.swimAmount);
    const previousSpeed = this.speed;
    // Matching the stopping distance keeps the faster horse controllable near a gate or a plot.
    const brake = 18 * this.mountSpeedFactor ** 2;
    const stoppingSpeed = this.target && this.waypoints.length === 0 ? Math.sqrt(2 * brake * distanceLeft) : Infinity;
    const goalSpeed = Math.min(strength * maxSpeed * alignment, stoppingSpeed);
    if (strength > 0) this.speed = THREE.MathUtils.damp(previousSpeed, goalSpeed, 16, dt);
    else this.speed = Math.max(0, previousSpeed - brake * dt) * (1 - this.swimAmount);
    const speedForStep = strength === 0 && this.swimAmount === 1 ? 0 : (previousSpeed + this.speed) * 0.5;

    this.previous.copy(this.position);
    if (speedForStep > 0) {
      if (this.target || (strength > 0 && this.swimAmount >= 0.5)) dir.normalize();
      else dir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.position.addScaledVector(dir, Math.min(distanceLeft, speedForStep * dt));
      // 脚底已经高过某个低矮物体顶面时，水平移动可以越过它。
      this.obstacles.move(this.previous, this.position, this.onDeck ? "deck" : "terrain", this.root.position.y);
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
      THREE.MathUtils.smoothstep(speed / gaitScale, Player.WALK_SPEED, Player.RUN_SPEED), 12, dt);
    motion.moving = THREE.MathUtils.damp(motion.moving, Math.min(1, speed / 0.85), 20, dt);
    // Blending toward idle shortens each planted leg's backward sweep. Shorten
    // the distance per cycle by the same proportion for analog steps.
    const stride = THREE.MathUtils.lerp(1.32, 1.97, motion.running) * Math.max(0.16, motion.moving);
    motion.phase = (motion.phase + distance / (stride * gaitScale)) % 1;

    // Capture frames 32–108 gather and extend, 108–178 are airborne,
    // then 178–248 absorb impact and recover. The parabola starts at toe-off.
    const jumpFootBefore = this.root.position.y;
    if (this.jumpTime >= 0) {
      const previousJumpHeight = this.jumpHeight;
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
      this.jumpHeight = 4 * Player.JUMP_HEIGHT * air * (1 - air);
      // 下落时若脚下正好穿过某个可落脚顶面，就落在它上面，而不是继续穿过去。
      const platformTop = this.obstacles.platformTopAt(
        this.position.x, this.position.z, jumpFootBefore + 0.02);
      const descending = this.jumpHeight < previousJumpHeight - 1e-5;
      const newFootY = this.jumpBaseY + this.jumpHeight;
      if (descending && platformTop !== undefined && platformTop > surface.floorY + 0.02 &&
          jumpFootBefore >= platformTop - 0.02 && newFootY <= platformTop + 0.02) {
        this.groundY = platformTop;
        this.cameraFloorY = Math.max(platformTop, surface.waterY);
        this.jumpHeight = 0;
        this.jumpTime = -1;
        motion.jumpWeight = 0;
      }
      // 土丘、草台这类连续地形没有单独的碰撞顶面：下落穿过坡面时直接落在坡上，
      // 否则 groundY 还停在起跳低处，人会先陷进土丘再被阻尼抬出来。
      if (descending && surface.floorY > this.jumpBaseY + 0.02 &&
          newFootY <= surface.floorY + 0.02) {
        this.groundY = surface.floorY;
        this.cameraFloorY = Math.max(surface.floorY, surface.waterY);
        this.jumpHeight = 0;
        this.jumpTime = -1;
        motion.jumpWeight = 0;
      }
      if (t >= end) {
        this.jumpTime = -1;
        this.jumpHeight = 0;
        // 收尾帧也把脚下地面夹到当前坡面，避免落地后先埋进去再弹出来。
        this.groundY = Math.max(this.groundY, surface.floorY);
        this.cameraFloorY = Math.max(this.cameraFloorY, surface.floorY);
      }
    }
    // 站在平台顶面时持续跟随它；跳跃中保持起跳基座不塌回地面。
    const platformTop = this.jumpTime < 0
      ? this.obstacles.platformTopAt(this.position.x, this.position.z, this.root.position.y + 0.10)
      : undefined;
    const support = this.jumpTime >= 0
      ? this.groundY
      : THREE.MathUtils.lerp(Math.max(surface.floorY, platformTop ?? -Infinity), surface.waterY, motion.swimming);
    this.groundY = THREE.MathUtils.damp(this.groundY, support, 16, dt);
    this.cameraFloorY = Math.max(this.cameraFloorY, platformTop ?? -Infinity);
    // 动作状态机：移动输入、跳跃、下水、骑乘都会打断；一次性动作播完自动收尾。
    if (this.actionId) {
      if (strength > 0 || this.jumpTime >= 0 || motion.swimming > 0.35 || riding) this.actionId = null;
      else {
        this.actionTime += dt;
        const duration = ACTIONS[this.actionId].duration;
        if (duration !== null && this.actionTime >= duration) this.actionId = null;
      }
    }
    motion.action = this.actionId;
    motion.actionTime = this.actionTime;
    motion.actionWeight = this.actionId ? actionWeight(this.actionId, this.actionTime) : 0;
    const airborneFoot = this.groundY + this.jumpHeight * (1 - motion.swimming);
    // 空中和站走都把脚底夹到当前坡面以上：土丘升高时让玩家沿坡面抬脚，不能穿进模型。
    const footY = this.jumpTime >= 0
      ? Math.max(airborneFoot, surface.floorY)
      : Math.max(this.groundY, surface.floorY);
    this.root.position.set(this.position.x, footY, this.position.z);
    this.root.rotation.y = this.facing;
    this.rig.animate?.(dt, t, motion);
  }
}
