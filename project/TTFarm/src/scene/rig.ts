import type * as THREE from "three";
import type { AvatarId, OutfitId } from "../game/appearance";

/** 一次性打击动作与可持续的表情动作；移动、跳跃、骑乘、游泳会取消它们。 */
export type ActionId = "punch" | "kick" | "cheer" | "dance" | "lie" | "faint" | "sit" | "fishWait" | "fishCast" | "fishReel";

export interface AvatarMotion {
  /** Left heel strike is phase zero in both locomotion clips. */
  phase: number;
  moving: number;
  running: number;
  /** Signed turn rate, positive when turning toward the actor's right. */
  turn?: number;
  jumpPhase: number;
  jumpWeight: number;
  /** Water support blended from wading to full flotation. */
  swimming: number;
  /** One full breaststroke or sculling cycle. */
  swimPhase: number;
  /** Height of the saddle above the actor's root, zero while on foot. */
  saddleHeight?: number;
  /** Submerged terrain beneath each shoe, including sloping banks. */
  waterFloor?: (x: number, z: number) => number;
  /** 当前动作；null 表示回到常规 locomotion。 */
  action?: ActionId | null;
  /** 动作开始以来的秒数。 */
  actionTime?: number;
  /** 0..1 的动作混合权重，淡入淡出由 Player/peers 统一计算。 */
  actionWeight?: number;
}

export interface AvatarRig {
  visual: THREE.Group;
  setAppearance?: (avatar: AvatarId, outfit: OutfitId, bottom?: OutfitId) => void;
  animate?: (dt: number, time: number, motion: AvatarMotion) => void;
  dispose: () => void;
}
