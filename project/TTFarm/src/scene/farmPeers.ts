import * as THREE from "three";
import { normalizeAppearance } from "../game/appearance";
import type { SocialPlayer } from "../game/social";
import { Player } from "./player";
import { createHorseTrail } from "./horseTrail";
import { createAnimalLibrary, saddleHeight } from "./ranchAnimals";
import type { WorldObstacles } from "./obstacles";
import type { AvatarMotion, ActionId } from "./rig";
import { ACTIONS, actionWeight, isActionId } from "./actionMotion";
import type { createRanchAuras } from "./ranchAuras";
import type { RanchAnimal } from "../game/ranch";

function nameplate(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 384; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 32px system-ui, sans-serif";
  const width = Math.min(380, Math.ceil(ctx.measureText(name).width + 34));
  ctx.fillStyle = "rgba(33, 48, 37, .85)";
  ctx.beginPath();
  ctx.roundRect((384 - width) / 2, 4, width, 54, 22);
  ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff4db"; ctx.fillText(name, 192, 32, width - 20);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.95, .325, 1);
  return { sprite, dispose() { map.dispose(); material.dispose(); sprite.removeFromParent(); } };
}

/** Network samples set a destination. Frames between them drive the same gait and wardrobe as the local avatar. */
export function createFarmPeers(obstacles: WorldObstacles, heightAt: (x: number, z: number) => number,
                               library: ReturnType<typeof createAnimalLibrary>) {
  const group = new THREE.Group();
  group.name = "farm-visitors";
  type Auras = ReturnType<typeof createRanchAuras>;
  let visitMount: ReturnType<typeof library.create> | undefined;
  let visitMountId: string | undefined;
  let visitElement: RanchAnimal["element"] = null, visitHeight = 0, ridePhase = 0;
  function createPeer(sample: SocialPlayer, detailed: boolean) {
    const look = normalizeAppearance(sample.avatarId, sample.outfitId, sample.bottomId);
    const avatar = new Player(look.avatarId, obstacles, heightAt, look.outfitId, look.bottomId, true, detailed);
    const root = avatar.root;
    root.position.set(sample.x, sample.y, sample.z);
    root.rotation.y = sample.yaw;
    group.add(root);
    let label = nameplate(sample.nickname);
    root.add(label.sprite);
    const start = root.position.clone(), end = start.clone();
    let mount: ReturnType<typeof library.create> | undefined;
    let horseTrail: ReturnType<typeof createHorseTrail> | undefined;
    let last: SocialPlayer | undefined, elapsed = 0, duration = .8, yawFrom = sample.yaw, yawDelta = 0;
    let jumpTime = 0;
    let actionId: ActionId | null = null, actionTime = 0;
    const motion: AvatarMotion = { phase: 0, moving: 0, running: 0, jumpPhase: 0, jumpWeight: 0, swimming: 0, swimPhase: 0 };
    return {
      aura(auras: Auras, time: number) {
        if (root.visible && last?.mount?.element) auras.animal(root.position, saddleHeight(last.mount.species), last.mount.element, time, Number(last.id) % 31);
      },
      update(next: SocialPlayer, dt: number, time: number, focus: THREE.Vector3) {
        if (!last || last.lastSeen !== next.lastSeen || last.nickname !== next.nickname ||
            last.avatarId !== next.avatarId || last.outfitId !== next.outfitId || last.bottomId !== next.bottomId) {
          if (last?.nickname !== next.nickname && last) {
            label.dispose(); label = nameplate(next.nickname); root.add(label.sprite);
          }
          const outfit = normalizeAppearance(next.avatarId, next.outfitId, next.bottomId);
          avatar.setAppearance(outfit.avatarId, outfit.outfitId, outfit.bottomId);
          if (next.mount?.species !== last?.mount?.species || next.mount?.element !== last?.mount?.element) {
            mount?.group.removeFromParent(); mount?.dispose();
            mount = next.mount ? library.create(next.mount.species, next.mount.element, true) : undefined;
            if (mount) root.add(mount.group);
          }
          duration = last ? THREE.MathUtils.clamp((next.lastSeen - last.lastSeen) / 1000, .18, 1.8) : .8;
          start.copy(root.position); end.set(next.x, next.y, next.z);
          // At full gallop a horse can cross 15 metres between two normal heartbeats.
          const jumpDistance = next.mount?.species === "horse"
            ? Math.max(15, Player.maxMountedRunSpeed("horse") * duration + 4) : 15;
          if (start.distanceToSquared(end) > jumpDistance ** 2) {
            start.copy(end);
            horseTrail?.clear();
          }
          yawFrom = root.rotation.y;
          yawDelta = THREE.MathUtils.euclideanModulo(next.yaw - yawFrom + Math.PI, 2 * Math.PI) - Math.PI;
          if (next.jumping && !last?.jumping) jumpTime = 0;
          elapsed = 0; last = next;
        }
        const x = root.position.x, z = root.position.z;
        elapsed += dt;
        const blend = Math.min(1, elapsed / duration);
        root.position.lerpVectors(start, end, blend);
        root.rotation.y = yawFrom + yawDelta * blend;
        root.visible = root.position.distanceToSquared(focus) < 95 ** 2;
        if (!root.visible) { horseTrail?.clear(); return; }
        const travel = Math.hypot(root.position.x - x, root.position.z - z);
        const galloping = next.mount?.species === "horse" && next.running && next.moving && travel > .001;
        if (galloping && !horseTrail) {
          horseTrail = createHorseTrail();
          group.add(horseTrail.mesh);
        }
        horseTrail?.update(time, root.position, root.rotation.y, galloping);
        motion.moving = THREE.MathUtils.damp(motion.moving, Math.min(1, travel / Math.max(.001, dt * .85)), 12, dt);
        motion.running = THREE.MathUtils.damp(motion.running, next.running ? 1 : 0, 10, dt);
        const stride = next.mount ? (next.running ? 3.6 : 2.7) : (next.running ? 1.97 : 1.32);
        motion.phase = (motion.phase + travel / stride) % 1;
        motion.swimming = THREE.MathUtils.damp(motion.swimming, next.swimming ? 1 : 0, 9, dt);
        motion.swimPhase = (motion.swimPhase + dt * .48 + travel * .33) % 1;
        jumpTime += dt;
        motion.jumpPhase = Math.min(1, jumpTime / 1.22);
        motion.jumpWeight = THREE.MathUtils.damp(motion.jumpWeight, next.jumping ? 1 : 0, 9, dt);
        // 动作回放：心跳之间本地推进动作时钟；对方移动/下水/骑乘时立即打断。
        const nextAction = next.moving || next.swimming || next.mount ? null : isActionId(next.action) ? next.action : null;
        if (nextAction !== actionId) { actionId = nextAction; actionTime = next.actionTime ?? 0; }
        else if (actionId) actionTime += dt;
        if (actionId) {
          const duration = ACTIONS[actionId].duration;
          if (duration !== null && actionTime >= duration) actionId = null;
        }
        if (actionId) {
          motion.action = actionId;
          motion.actionTime = actionTime;
          motion.actionWeight = actionWeight(actionId, actionTime);
        } else {
          motion.actionWeight = THREE.MathUtils.damp(motion.actionWeight ?? 0, 0, 12, dt);
          if ((motion.actionWeight ?? 0) < 0.02) { motion.action = null; motion.actionWeight = 0; }
        }
        mount?.animate(time, motion.phase * 2 * Math.PI, motion.moving * (.54 + .46 * motion.running), root.position.distanceToSquared(focus));
        motion.saddleHeight = mount?.seatHeight ?? 0;
        label.sprite.position.y = 1.92 + Math.max(0, motion.saddleHeight - .6);
        avatar.animatePeer(dt, time, motion);
      },
      dispose() {
        horseTrail?.dispose();
        label.dispose(); mount?.dispose(); avatar.dispose(); root.removeFromParent();
      },
    };
  }
  const peers = new Map<string, ReturnType<typeof createPeer>>();
  let roster: SocialPlayer[] | null = null;
  function clearRide() {
    visitMount?.group.removeFromParent(); visitMount?.dispose(); visitMount = undefined; visitMountId = undefined;
  }
  function clear() { peers.forEach(peer => peer.dispose()); peers.clear(); roster = null; clearRide(); }
  return { group, clear,
    seatHeight(id:string) { return id===visitMountId?visitMount?.seatHeight:undefined; },
    localRide(animal: RanchAnimal | undefined, player: Player, dt: number, time: number) {
      if (animal?.id !== visitMountId) {
        clearRide();
        if (animal) {
          visitMount = library.create(animal.species,animal.element,true);
          visitMountId = animal.id; visitElement = animal.element; visitHeight = saddleHeight(animal.species);
          group.add(visitMount.group);
        }
      }
      if (!visitMount) return;
      visitMount.group.position.copy(player.root.position);
      visitMount.group.rotation.y = player.root.rotation.y;
      if (player.isMoving) ridePhase += dt * (player.isRunning ? 10 : 7);
      visitMount.animate(time, ridePhase, player.isMoving ? (player.isRunning ? 1 : .54) : 0);
    },
    emitAuras(auras: Auras, time: number) {
      if (visitMount && visitElement) auras.animal(visitMount.group.position, visitHeight, visitElement, time, 0);
      peers.forEach(peer => peer.aura(auras, time));
    },
    update(samples: SocialPlayer[], dt: number, time: number, focus: THREE.Vector3) {
      if (roster !== samples) {
        roster = samples;
        const ids = new Set(samples.map(sample => sample.id));
        for (const [id, peer] of peers) if (!ids.has(id)) { peer.dispose(); peers.delete(id); }
      }
      for (const sample of samples) {
        let peer = peers.get(sample.id);
        if (!peer) { peer = createPeer(sample, peers.size < 4); peers.set(sample.id, peer); }
        peer.update(sample, dt, time, focus);
      }
    },
  };
}
