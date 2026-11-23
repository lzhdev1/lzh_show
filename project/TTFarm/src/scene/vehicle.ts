import * as THREE from "three";
import { buildDetailedCar } from "./town/townCar";
import { carModelOf, type OwnedCar } from "../game/garage";
import { BRIDGE, bridgeHeightAt, onBridge, riverInfo, RIVER_BED } from "./layout";
import type { WorldObstacles } from "./obstacles";

/** 桥头坡道倾角上限，避免贴边转向时车身做出夸张的俯仰。 */
const MAX_RAMP_PITCH = 0.24;

export interface VehicleInput {
  throttle: number;
  steer: number;
  brake: boolean;
  boost: boolean;
}

/** 玩家驾驶车辆：局部 +x 为车头；四轮独立转动，车身用大半径占位检测。 */
export class PlayerVehicle {
  readonly root: THREE.Group;
  private wheels: THREE.Group[];
  private frontWheels: THREE.Group[];
  private heading: number;
  private speed = 0;
  private readonly model;
  private readonly bodyRadius = 1.05;

  constructor(car: OwnedCar, x: number, z: number, heading: number, surfaceY = 0) {
    this.model = carModelOf(car.model);
    const built = buildDetailedCar(car.color, car.model, car.plate);
    this.root = built.root;
    this.wheels = built.wheels;
    this.frontWheels = built.frontWheels;
    this.root.scale.setScalar(this.model.scale);
    this.root.position.set(x, surfaceY, z);
    this.heading = heading;
    this.root.rotation.y = heading;
    this.root.name = "player-vehicle";
  }

  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  get currentSpeed() { return this.speed; }
  get yaw() { return this.heading; }

  update(dt: number, input: VehicleInput, obstacles: WorldObstacles, groundAt: (x: number, z: number) => number) {
    const max = this.model.speed * (input.boost ? 1.32 : 1);
    const target = input.throttle > 0 ? max * input.throttle : input.throttle < 0 ? -4.2 : 0;
    const accel = input.throttle !== 0 ? 5.2 : 2.4;
    this.speed = THREE.MathUtils.damp(this.speed, target, accel, dt);
    if (input.brake) this.speed = THREE.MathUtils.damp(this.speed, 0, 14, dt);

    const steerStrength = Math.min(1, Math.abs(this.speed) / 3.4) * this.model.handling;
    if (Math.abs(this.speed) > 0.05) {
      const direction = this.speed < 0 ? -1 : 1;
      this.heading -= input.steer * 1.65 * steerStrength * direction * dt;
    }

    const fx = Math.cos(this.heading), fz = -Math.sin(this.heading);
    let dx = fx * this.speed * dt;
    let dz = fz * this.speed * dt;
    const curX = this.root.position.x, curZ = this.root.position.z;

    const allowed = (x: number, z: number) => {
      if (riverInfo(x, z).dist < RIVER_BED.shoulder - 0.8 && bridgeHeightAt(x, z) === undefined) return false;
      // 整车统一用中心所在层：桥头过渡带若三点分层，会出现「中心在坡道、车头在桥面」而卡死
      const layer = onBridge(x, z, 1.6) ? "deck" : "terrain";
      const candidate = { x, z };
      if (!obstacles.canOccupy(x, z, this.bodyRadius, layer)) return false;
      const front = { x: candidate.x + fx * 1.55, z: candidate.z + fz * 1.55 };
      const rear = { x: candidate.x - fx * 1.55, z: candidate.z - fz * 1.55 };
      if (!obstacles.canOccupy(front.x, front.z, 0.58, layer)) return false;
      if (!obstacles.canOccupy(rear.x, rear.z, 0.58, layer)) return false;
      return true;
    };

    if (allowed(curX + dx, curZ + dz)) {
      this.root.position.x += dx;
      this.root.position.z += dz;
    } else if (allowed(curX + dx, curZ)) {
      this.root.position.x += dx;
      this.speed *= 0.72;
    } else if (allowed(curX, curZ + dz)) {
      this.root.position.z += dz;
      this.speed *= 0.72;
    } else {
      this.speed = 0;
    }

    // 桥宽约束：车不能从栏杆缝里滑出去
    if (onBridge(this.root.position.x, this.root.position.z, 0.6)) {
      const dx0 = this.root.position.x - BRIDGE.x;
      const dz0 = this.root.position.z - BRIDGE.z;
      const along = dx0 * BRIDGE.nx + dz0 * BRIDGE.nz;
      const across = -dx0 * BRIDGE.nz + dz0 * BRIDGE.nx;
      if (Math.abs(across) > BRIDGE.halfWidth - 0.95) {
        const clamped = Math.sign(across) * (BRIDGE.halfWidth - 0.95);
        this.root.position.x = BRIDGE.x + BRIDGE.nx * along + BRIDGE.nz * clamped;
        this.root.position.z = BRIDGE.z + BRIDGE.nz * along - BRIDGE.nx * clamped;
        this.speed *= 0.4;
      }
    }

    this.root.position.y = groundAt(this.root.position.x, this.root.position.z);
    // 桥头坡道让车身顺着坡度抬头/低头；桥面本身保持水平。
    const bridgeDx = this.root.position.x - BRIDGE.x;
    const bridgeDz = this.root.position.z - BRIDGE.z;
    const bridgeAlong = bridgeDx * BRIDGE.nx + bridgeDz * BRIDGE.nz;
    const bridgeAcross = -bridgeDx * BRIDGE.nz + bridgeDz * BRIDGE.nx;
    const onRamp = Math.abs(bridgeAlong) > BRIDGE.halfLength &&
      Math.abs(bridgeAlong) <= BRIDGE.halfLength + BRIDGE.rampLength &&
      Math.abs(bridgeAcross) <= BRIDGE.halfWidth - 0.12;
    const pitch = onRamp
      ? THREE.MathUtils.clamp(
          Math.atan((bridgeAlong > 0 ? -1 : 1) * (BRIDGE.deckY / BRIDGE.rampLength) * (fx * BRIDGE.nx + fz * BRIDGE.nz)),
          -MAX_RAMP_PITCH, MAX_RAMP_PITCH)
      : 0;
    this.root.rotation.set(0, this.heading, pitch);
    const spin = (this.speed / 0.37) * dt;
    for (const wheel of this.wheels) wheel.rotation.z -= spin;
    // 前轮随方向轻微摆动，侧窗里能看出车在转向
    const steerAngle = -input.steer * 0.4;
    for (const wheel of this.frontWheels) {
      wheel.rotation.y = THREE.MathUtils.damp(wheel.rotation.y, steerAngle, 7, dt);
    }
  }

  dispose() {
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const list = Array.isArray(node.material) ? node.material : [node.material];
      list.forEach((m) => m.dispose());
    });
    this.root.removeFromParent();
  }
}
