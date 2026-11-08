import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createView, CAMERA_HOME, CAMERA_TARGET } from "../scene/view";
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

  // 视角可自由环绕，因此屏幕方向每帧从相机现算，WASD 永远跟着当前画面走
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const screenRight = new THREE.Vector3();
  const screenUp = new THREE.Vector3();

  // 60° 自由环绕：方位不设限，但极角与距离都限位，保证任何角度都是成立的构图，
  // 不会转到地面以下、也不会把主体挤出画面
  const controls = new OrbitControls(view.camera, canvas);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.2;
  controls.update();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = new Set<string>();
  const inputDir = new THREE.Vector3();

  // —— 键盘 ——
  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };

  // 回正到初始等距构图；键盘 R 与双击画面共用同一个动作
  const resetView = () => {
    view.camera.position.copy(CAMERA_HOME);
    controls.target.copy(CAMERA_TARGET);
    controls.update();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === "r") {
      resetView();
      return;
    }
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

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", resetView);

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
    view.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    screenRight.crossVectors(forward, WORLD_UP).normalize();
    screenUp.crossVectors(screenRight, forward).normalize();

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

    controls.update();
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
    canvas.removeEventListener("dblclick", resetView);
    controls.dispose();unsubAvatar();
    disposePlots(plots);
    view.dispose();
  };

  return { dispose };
}
