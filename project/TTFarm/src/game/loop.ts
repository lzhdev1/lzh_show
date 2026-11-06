import * as THREE from "three";
import { createView } from "../scene/view";
import { createWorld } from "../scene/world";
import { createPlots, disposePlots, plotPosition, updatePlots, PLOT_SIZE } from "../scene/plots";
import { Player } from "../scene/player";
import { useGame } from "./state";
import { tickClock } from "./clock";

export interface GameHandle {
  dispose: () => void;
}

export function startGame(canvas: HTMLCanvasElement): GameHandle {
  const view = createView(canvas);
  const world = createWorld();
  view.scene.add(world.group);

  const plots = createPlots();
  view.scene.add(plots.group);

  const player = new Player(useGame.getState().avatarId);
  view.scene.add(player.root);

  // 视角固定为等距方向，因此屏幕右/上方向的世界向量只需算一次
  const forward = new THREE.Vector3();
  view.camera.getWorldDirection(forward);
  const screenRight = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const screenUp = new THREE.Vector3().crossVectors(screenRight, forward).normalize();
  screenUp.y = 0;
  screenUp.normalize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = new Set<string>();
  const inputDir = new THREE.Vector3();

  // —— 键盘 ——
  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      keys.add(key);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  const onBlur = () => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // —— 指针 ——
  let downX = 0;
  let downY = 0;
  let downAt = 0;

  const updatePointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const walkToPlot = (plotId: number) => {
    const center = plotPosition(plotId);
    const fromPlayer = player.positionRef.clone().sub(center);
    fromPlayer.y = 0;
    if (fromPlayer.lengthSq() < 0.0001) fromPlayer.set(0, 0, 1);
    fromPlayer.normalize();
    const stand = center.clone().addScaledVector(fromPlayer, PLOT_SIZE / 2 + 0.35);

    if (player.positionRef.distanceTo(center) < 2.2) {
      useGame.getState().selectPlot(plotId);
      return;
    }
    useGame.getState().selectPlot(null);
    player.moveTo(stand, () => useGame.getState().selectPlot(plotId));
  };

  const handleClick = (e: PointerEvent) => {
    updatePointer(e);
    raycaster.setFromCamera(pointer, view.camera);

    const plotHits = raycaster.intersectObjects(plots.meshes, false);
    if (plotHits.length > 0) {
      const id = plotHits[0].object.userData.plotId as number;
      walkToPlot(id);
      return;
    }

    const groundHits = raycaster.intersectObject(world.ground, false);
    if (groundHits.length > 0) {
      const point = groundHits[0].point;
      point.y = 0;
      point.x = THREE.MathUtils.clamp(point.x, -5.8, 5.8);
      point.z = THREE.MathUtils.clamp(point.z, -7.4, 7.4);
      useGame.getState().selectPlot(null);
      player.moveTo(point);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    downAt = performance.now();
  };

  const onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 8 && performance.now() - downAt < 700) handleClick(e);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view.setViewHeight(view.getViewHeight() + Math.sign(e.deltaY) * 0.9);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // —— 存档里的形象变化同步到 3D ——
  let lastAvatar = useGame.getState().avatarId;
  const unsubAvatar = useGame.subscribe((state) => {
    if (state.avatarId !== lastAvatar) {
      lastAvatar = state.avatarId;
      player.setAvatar(state.avatarId);
    }
  });

  // —— 主循环 ——
  let raf = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let clockAcc = 0;

  const frame = (nowMs: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      lastTime = nowMs;
      return;
    }
    const dt = Math.min((nowMs - lastTime) / 1000, 0.05);
    lastTime = nowMs;
    elapsed += dt;

    inputDir.set(0, 0, 0);
    if (keys.has("w") || keys.has("arrowup")) inputDir.add(screenUp);
    if (keys.has("s") || keys.has("arrowdown")) inputDir.sub(screenUp);
    if (keys.has("d") || keys.has("arrowright")) inputDir.add(screenRight);
    if (keys.has("a") || keys.has("arrowleft")) inputDir.sub(screenRight);

    const state = useGame.getState();
    player.update(dt, elapsed, inputDir.lengthSq() > 0 ? inputDir : null);
    updatePlots(plots, state.plots, state.selectedPlot, Date.now(), elapsed);

    clockAcc += dt;
    if (clockAcc >= 0.5) {
      clockAcc = 0;
      tickClock();
    }

    view.renderer.render(view.scene, view.camera);
  };
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    unsubAvatar();
    disposePlots(plots);
    view.dispose();
  };

  return { dispose };
}
