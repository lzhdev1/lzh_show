import * as THREE from "three";
import { RIVER_BED } from "./layout";
import { currentCastSite, useFishing } from "../game/fishing";
import { rodById } from "../game/fish";
import { useGame } from "../game/state";
import { createRodAsset, createRiverFishScene } from "./riverFish";
import { createFishingAudio } from "./fishingAudio";
import type { Player } from "./player";

/**
 * 钓鱼的 3D 表现层：鱼竿、鱼线、鱼漂、水花与用力时的抖线。
 * 时间状态全部读 fishing store；这里不接受玩家输入，避免和 HUD 抢状态机。
 */
export function createFishingScene(player: Player) {
  const group = new THREE.Group();
  group.name = "fishing-rig";
  const rod = createRodAsset();
  group.add(rod.group);

  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(12 * 3);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
    color: "#f3f0d7", transparent: true, opacity: 0.72,
  }));
  line.frustumCulled = false;
  line.renderOrder = 4;
  group.add(line);

  const bobber = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: "#f5f2e2", roughness: 0.4 }),
  );
  stem.position.y = 0.06;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#d94a34", roughness: 0.3, metalness: 0.15, emissive: "#4a120a", emissiveIntensity: 0.18 }),
  );
  cap.position.y = 0.14;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.056, 0.007, 5, 18),
    new THREE.MeshBasicMaterial({ color: "#ffe3a0", transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  bobber.add(stem, cap, ring);
  bobber.visible = false;
  group.add(bobber);

  const ringMat = new THREE.MeshBasicMaterial({ color: "#d8f3e6", transparent: true, opacity: 0.0, side: THREE.DoubleSide });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), ringMat.clone());
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = RIVER_BED.waterY + 0.008;
    ripple.visible = false;
    ripple.renderOrder = 2;
    rings.push(ripple);
    group.add(ripple);
  }

  // 钓线落水的细小水花
  const splashMat = new THREE.PointsMaterial({ color: "#e9fff6", size: 0.035, transparent: true, opacity: 0.7 });
  const splashGeo = new THREE.BufferGeometry();
  const splashPos = new Float32Array(18 * 3);
  splashGeo.setAttribute("position", new THREE.BufferAttribute(splashPos, 3));
  const splash = new THREE.Points(splashGeo, splashMat);
  splash.visible = false;
  splash.frustumCulled = false;
  group.add(splash);
  let splashAt = -1;
  const splashBase = new THREE.Vector3();

  const audio = createFishingAudio();
  let lastPhase = "";
  let target = new THREE.Vector3(0, RIVER_BED.waterY, 0);
  let hasTarget = false;
  const base = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const tipPos = new THREE.Vector3();
  const bobPos = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const castStart = new THREE.Vector3();
  const now024 = () => performance.now() / 1000;

  const waterY = RIVER_BED.waterY;

  function updateRipples(now: number, center: THREE.Vector3, strength: number) {
    const t = now / 1000;
    rings.forEach((r, i) => {
      const local = (t * (0.6 + strength * 1.4) + i * 0.37) % 1;
      r.position.set(center.x, waterY + 0.006, center.z);
      const scale = 0.12 + local * (0.32 + strength * 0.6);
      r.scale.setScalar(scale);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - local) * (0.16 + strength * 0.3);
      r.visible = strength > 0.02;
    });
  }

  function spawnSplash(at: THREE.Vector3, now: number) {
    splashAt = now;
    splashBase.copy(at);
    splash.visible = true;
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.18;
      splashPos[i * 3] = at.x + Math.cos(angle) * radius;
      splashPos[i * 3 + 1] = waterY;
      splashPos[i * 3 + 2] = at.z + Math.sin(angle) * radius;
    }
    splashGeo.attributes.position.needsUpdate = true;
  }

  function updateSplash(now: number) {
    if (splashAt < 0) return;
    const age = (now - splashAt) / 1000;
    if (age > 0.55) { splash.visible = false; splashAt = -1; return; }
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2;
      const r = 0.1 + (i % 3) * 0.05;
      splashPos[i * 3] = splashBase.x + Math.cos(a) * r * (1 + age * 2);
      splashPos[i * 3 + 2] = splashBase.z + Math.sin(a) * r * (1 + age * 2);
      splashPos[i * 3 + 1] = waterY + 0.03 + Math.sin(age * 23 + i) * 0.09 * Math.max(0, 1 - age / 0.55);
    }
    splashGeo.attributes.position.needsUpdate = true;
    splashMat.opacity = Math.max(0, 0.7 * (1 - age / 0.55));
  }

  function updateLine(from: THREE.Vector3, to: THREE.Vector3, slack: number) {
    for (let i = 0; i < 12; i += 1) {
      const t = i / 11;
      linePos[i * 3] = from.x + (to.x - from.x) * t;
      linePos[i * 3 + 1] = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * slack;
      linePos[i * 3 + 2] = from.z + (to.z - from.z) * t;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  function update(_dt: number, now: number) {
    const state = useFishing.getState();
    const p = player.root.position;
    const yaw = player.root.rotation.y;
    const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const phase = state.phase;

    if (phase !== lastPhase) {
      if (phase === "casting") {
        const site = currentCastSite();
        if (site) target.set(site.x, waterY, site.z);
        hasTarget = Boolean(site);
        audio.cast();
      } else if (phase === "waiting" && lastPhase === "casting") {
        audio.plop();
        spawnSplash(bobPos, now);
      } else if (phase === "bite") {
        audio.bite();
      } else if (phase === "reeling") {
        audio.bite();
      } else if (phase === "result") {
        if (state.result?.ok) audio.success(); else audio.fail();
      }
      lastPhase = phase;
    }

    const active = phase === "casting" || phase === "waiting" || phase === "bite" || phase === "reeling" || phase === "result";
    rod.group.visible = phase !== "idle";
    line.visible = active && phase !== "result";
    bobber.visible = active && phase !== "result";
    if (!active) {
      line.visible = false; bobber.visible = false;
      rings.forEach((r) => { r.visible = false; });
      splash.visible = false;
      audio.updateReel(false, 0, _dt);
      return;
    }

    if (!hasTarget) {
      target.set(p.x + fwdX * 3.4, waterY, p.z + fwdZ * 3.4);
      hasTarget = true;
    }
    const rodSet = rodById(useGame.getState().fishingRod);
    if (rodSet) rod.set(rodSet);

    // 竿根：右手前方，略偏右
    base.set(p.x + fwdX * 0.28 + rightX * 0.3, p.y + 1.02, p.z + fwdZ * 0.28 + rightZ * 0.3);
    rod.group.position.copy(base);
    const castT = phase === "casting" ? Math.min(1, (now - state.phaseAt) / 900) : 1;
    const extend = phase === "casting" ? THREE.MathUtils.smoothstep(castT, 0.28, 1) : 1;
    if (phase === "casting" && castT < 0.35) {
      dir.set(fwdX * -0.25 + rightX * 0.18, 0.92, fwdZ * -0.25 + rightZ * 0.18).normalize();
    } else {
      const bend = phase === "bite" ? 0.06 : phase === "reeling" ? 0.28 + Math.sin(now024() * 13) * 0.04 : 0.02;
      dir.set(fwdX * (0.82 + extend * 0.08) + rightX * 0.12, 0.42 - bend, fwdZ * 0.82 + rightZ * 0.12).normalize();
    }
    q.setFromUnitVectors(up, dir);
    rod.group.quaternion.copy(q);
    rod.group.updateWorldMatrix(true, false);
    rod.tip.getWorldPosition(tipPos);

    // 若还处在抛竿阶段，鱼漂跟随竿尖划出一条抛物线
    if (phase === "casting") {
      castStart.copy(tipPos);
      const fall = THREE.MathUtils.smoothstep(castT, 0.35, 1);
      bobPos.lerpVectors(castStart, target, fall);
      bobPos.y += Math.sin(Math.PI * fall) * 1.15 - (1 - fall) * 0.2;
      if (castT >= 1) { hasTarget = true; }
    } else {
      const t = now / 1000;
      const jitter = phase === "waiting" ? 0.014 : phase === "bite" ? 0.06 : 0.09;
      bobPos.copy(target);
      if (phase === "waiting") {
        bobPos.x += Math.sin(t * 3.1) * jitter + Math.sin(t * 7.7) * 0.005;
        bobPos.z += Math.cos(t * 2.7) * jitter + Math.sin(t * 8.3) * 0.005;
        bobPos.y = waterY + 0.075 + Math.sin(t * 4.2) * 0.012;
      } else if (phase === "bite") {
        const biteAge = (now - state.biteStart) / 1000;
        bobPos.x += Math.sin(biteAge * 8) * 0.24 + Math.sin(t * 5.3) * jitter;
        bobPos.z += Math.cos(biteAge * 7.2) * 0.2 + Math.cos(t * 4.9) * jitter;
        bobPos.y = state.biteKind === "sink"
          ? waterY - 0.07 + Math.sin(biteAge * 10) * 0.035
          : waterY + 0.1 + Math.sin(biteAge * 9) * 0.045;
      } else if (phase === "reeling") {
        const reelAge = Math.max(0, (now - state.reelAt) / 1000);
        const shore = THREE.MathUtils.clamp(reelAge / 5.5, 0, 1);
        const dist = THREE.MathUtils.lerp(
          Math.hypot(target.x - p.x, target.z - p.z),
          1.0,
          shore,
        );
        const angle = Math.atan2(target.x - p.x, target.z - p.z);
        bobPos.set(
          p.x + Math.sin(angle + Math.sin(reelAge * 4.5) * 0.18) * dist,
          waterY + 0.12 + Math.sin(reelAge * 13) * 0.05,
          p.z + Math.cos(angle + Math.cos(reelAge * 4.1) * 0.18) * dist,
        );
      }
    }
    // 竿尖与鱼漂之间连线：等待时略松，拉鱼时绷紧
    updateLine(tipPos, bobPos, phase === "reeling" ? 0.001 : phase === "bite" ? 0.008 : 0.055);
    bobber.position.copy(bobPos);

    if (phase === "waiting" || phase === "bite" || phase === "reeling") {
      const strength = phase === "reeling" ? 0.8 : phase === "bite" ? 1 : 0.14;
      updateRipples(now, bobPos, strength);
    } else {
      rings.forEach((r) => { r.visible = false; });
    }
    updateSplash(now);

    const tension = phase === "reeling" ? THREE.MathUtils.clamp((now - state.reelAt) / 4000, 0, 1) : phase === "bite" ? 0.55 : 0;
    audio.updateReel(phase === "reeling", tension, _dt);
  }

  return {
    group,
    update,
    dispose: () => {
      audio.dispose();
      group.removeFromParent();
      rod.dispose();
      lineGeo.dispose();
      (line.material as THREE.Material).dispose();
      bobber.traverse((node) => {
        if (node instanceof THREE.Mesh) { node.geometry.dispose(); (node.material as THREE.Material).dispose(); }
      });
      rings.forEach((r) => { r.geometry.dispose(); (r.material as THREE.Material).dispose(); });
      splashGeo.dispose(); splashMat.dispose();
    },
  };
}

/** 河水区域专用鱼群；与钓鱼动作分开，玩家不在河边时也保持巡游。 */
export function attachRiverFish(groupParent: THREE.Group) {
  const school = createRiverFishScene();
  groupParent.add(school.group);
  return school;
}
