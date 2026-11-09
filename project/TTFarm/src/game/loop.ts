import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createView, CAMERA_HOME, CAMERA_TARGET } from "../scene/view";
import { createWorld } from "../scene/world";
import { createPlots, disposePlots, plotPosition, updatePlots, PLOT_SIZE, bedHeightAt } from "../scene/plots";
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

  // 田埂草台顶面 0.2；地块是隆起 0.26 的土垄，人物走在垄上要贴着土面起伏
  const FIELD_HALF_X = 4.75;
  const FIELD_HALF_Z = 6.45;
  const TERRACE_TOP = 0.2;
  const PLOT_HALF = PLOT_SIZE / 2;
  const groundHeightAt = (x: number, z: number) => {
    if (Math.abs(x) > FIELD_HALF_X || Math.abs(z) > FIELD_HALF_Z) return 0;
    for (const visual of plots.visuals) {
      const p = plotPosition(visual.id);
      const nx = (x - p.x) / PLOT_HALF;
      const nz = (z - p.z) / PLOT_HALF;
      if (Math.abs(nx) < 1 && Math.abs(nz) < 1) return TERRACE_TOP + bedHeightAt(nx, nz);
    }
    return TERRACE_TOP;
  };

  // 视角可自由环绕，因此屏幕方向每帧从相机现算，WASD 永远跟着当前画面走
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const screenRight = new THREE.Vector3();

  // 宽幅自由环绕：方位不设限，极角放开到接近贴地平视、也能俯冲到近乎正俯视，
  // 距离从贴身特写到整片农场远景都允许，但上下两极和最近最远仍留一格余量
  // 视角以人物为中心：OrbitControls 的 target 每帧跟住玩家，
  // 相机保持与 target 的相对偏移，于是拖拽就是绕人物转，走路时镜头也跟着人走
  const focus = new THREE.Vector3();
  const followDelta = new THREE.Vector3();
  // 以人物为中心后，初始机位保留原来的俯视角度，但把距离收到能把人看清的 10m
  const HOME_OFFSET = CAMERA_HOME.clone().sub(CAMERA_TARGET).normalize().multiplyScalar(10);

  const focusOnPlayer = (out: THREE.Vector3) => {
    const p = player.positionRef;
    return out.set(p.x, 0.95, p.z);
  };

  const controls = new OrbitControls(view.camera, canvas);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.8;
  controls.enablePan = false;
  controls.minDistance = 5.5;
  controls.maxDistance = 46;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = 1.47;
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

  // 回正：以人物为中心重新摆到初始等距构图；键盘 R 与双击画面共用同一个动作
  const resetView = () => {
    focusOnPlayer(focus);
    view.camera.position.copy(focus).add(HOME_OFFSET);
    controls.target.copy(focus);
    controls.update();
  };
  resetView();

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
      // 与人物同一套边界：门口走廊能走到围栏外，其余位置仍锁在场内
      point.x = THREE.MathUtils.clamp(point.x, -5.8, 5.8);
      if (Math.abs(point.x) > 1.2) {
        point.z = THREE.MathUtils.clamp(point.z, -7.4, 7.2);
      } else {
        point.z = THREE.MathUtils.clamp(point.z, -7.4, 16);
      }
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
    try {
      step(nowMs);
    } catch (err) {
      document.body.dataset.frameError = String((err as Error)?.stack ?? err);
      cancelAnimationFrame(raf);
      throw err;
    }
  };

  const step = (nowMs: number) => {
    const dt = Math.min((nowMs - lastTime) / 1000, 0.05);
    lastTime = nowMs;
    elapsed += dt;

    inputDir.set(0, 0, 0);
    view.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    screenRight.crossVectors(forward, WORLD_UP).normalize();

    // W/S 走"画面纵深"，A/D 走"画面左右"——都在水平面上，不会把人物往天上推
    if (keys.has("w") || keys.has("arrowup")) inputDir.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) inputDir.sub(forward);
    if (keys.has("d") || keys.has("arrowright")) inputDir.add(screenRight);
    if (keys.has("a") || keys.has("arrowleft")) inputDir.sub(screenRight);

    const state = useGame.getState();
    player.update(dt, elapsed, inputDir.lengthSq() > 0 ? inputDir : null);
    player.setGroundTarget(groundHeightAt(player.positionRef.x, player.positionRef.z));
    updatePlots(plots, state.plots, state.selectedPlot, Date.now(), elapsed);

    // 镜头跟人：target 始终锁在人物胸口高度，相机同步平移保持相对偏移
    focusOnPlayer(focus);
    followDelta.copy(focus).sub(controls.target);
    controls.target.copy(focus);
    view.camera.position.add(followDelta);

    clockAcc += dt;
    if (clockAcc >= 0.5) {
      clockAcc = 0;
      tickClock();
    }

    controls.update();
    world.update?.(elapsed);
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
    player.dispose();
    disposePlots(plots);
    view.dispose();
  };

  return { dispose };
}
