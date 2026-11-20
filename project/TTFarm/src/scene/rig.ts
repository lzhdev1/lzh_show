import type * as THREE from "three";
import type { AvatarId, OutfitId } from "../game/appearance";

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
  /** Submerged terrain beneath each shoe, including sloping banks. */
  waterFloor?: (x: number, z: number) => number;
}

export interface AvatarRig {
  visual: THREE.Group;
  setAppearance?: (avatar: AvatarId, outfit: OutfitId, bottom?: OutfitId) => void;
  animate?: (dt: number, time: number, motion: AvatarMotion) => void;
  dispose: () => void;
}
