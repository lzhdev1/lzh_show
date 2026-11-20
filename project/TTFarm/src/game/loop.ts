import * as THREE from "three";
import { createRiverAudio } from "../scene/riverAudio";
import { createFarmCamera } from "../scene/farmCamera";
import { createView } from "../scene/view";
import { createWorld } from "../scene/world";
import { createPlots, disposePlots, plotPosition, updatePlots, PLOT_SIZE, bedHeightAt } from "../scene/plots";
import { Player } from "../scene/player";
import { PLOT_COLS, PLOT_ROWS, useGame } from "./state";
import { farmInput, releaseTouchInput } from "./input";
import { weatherAt } from "./weather";
import { tickClock } from "./clock";

export interface GameHandle {
  dispose: () => void;
}

export function startGame(canvas: HTMLCanvasElement): GameHandle {
  const view = createView(canvas);
  const initial = useGame.getState();
  const world = createWorld(initial.decor);
  view.scene.add(world.group);

  const plots = createPlots();
  view.scene.add(plots.group);

  const riverAudio = createRiverAudio();

  // 田埂草台顶面 0.2；地块是隆起 0.26 的土垄，人物走在垄上要贴着土面起伏
  // 草台 17×14.4，装下 6×5 的田块
  const FIELD_HALF_X = 8.5;
  const FIELD_HALF_Z = 7.2;
  const TERRACE_TOP = 0.2;
  const PLOT_HALF = PLOT_SIZE / 2;
  const centers = plots.visuals.map((plot) => plotPosition(plot.id));
  const fieldHeightAt = (x: number, z: number) => {
    if (Math.abs(x) <= FIELD_HALF_X && Math.abs(z) <= FIELD_HALF_Z) {
      const col = Math.floor(x / PLOT_SIZE + PLOT_COLS / 2);
      const row = Math.floor(-z / PLOT_SIZE + PLOT_ROWS / 2);
      if (col >= 0 && col < PLOT_COLS && row >= 0 && row < PLOT_ROWS) {
        const id = row * PLOT_COLS + col;
        const p = centers[id];
        return TERRACE_TOP + bedHeightAt((x - p.x) / PLOT_HALF, (z - p.z) / PLOT_HALF, useGame.getState().plots[id]?.unlocked);
      }
      return TERRACE_TOP;
    }
    return 0;
  };
  const player = new Player(initial.avatarId, world.obstacles, fieldHeightAt, initial.outfitId, initial.bottomId);
  view.scene.add(player.root);

  // 视角可自由环绕，因此屏幕方向每帧从相机现算，WASD 永远跟着当前画面走
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const screenRight = new THREE.Vector3();

  const controls = createFarmCamera(canvas, view.camera, handleClick);
  controls.update(player.positionRef, player.cameraGroundY, 0, 0);
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
    if (farmInput.blocked || isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === "Space") {
      if (e.target instanceof HTMLElement && e.target.closest("button")) return;
      e.preventDefault();
      if (!e.repeat) farmInput.jump = true;
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "r") {
      controls.reset();
      return;
    }
    if (["q", "e", "shift", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      keys.add(key);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  const onBlur = () => { keys.clear(); releaseTouchInput(); };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // —— 指针 ——
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
      player.cancelTarget();
      useGame.getState().selectPlot(plotId);
      return;
    }
    useGame.getState().selectPlot(null);
    player.moveTo(stand, () => useGame.getState().selectPlot(plotId));
  };

  function handleClick(e: PointerEvent) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, view.camera);

    const plotHits = raycaster.intersectObjects(plots.meshes, false);
    if (plotHits.length > 0) {
      const id = plotHits[0].object.userData.plotId as number;
      walkToPlot(id);
      return;
    }

    // 地面和桥面一起参与拾取：点在桥上就落在桥面上，不会打穿到桥下的地面
    const groundHits = raycaster.intersectObjects(world.walkSurfaces, false);
    if (groundHits.length > 0) {
      useGame.getState().selectPlot(null);
      const hit = groundHits[0];
      player.moveTo(hit.point, undefined, hit.object.name.startsWith("bridge-"));
    }
  }

  const unsubscribeAppearance = useGame.subscribe((state, previous) => {
    if (state.avatarId !== previous.avatarId || state.outfitId !== previous.outfitId || state.bottomId !== previous.bottomId) {
      player.setAppearance(state.avatarId, state.outfitId, state.bottomId);
    }
    if (state.decor !== previous.decor) world.setDecor(state.decor);
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
    const dt = Math.min((nowMs - lastTime) / 1000, 0.1);
    lastTime = nowMs;
    elapsed += dt;

    inputDir.set(0, 0, 0);
    view.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    screenRight.crossVectors(forward, WORLD_UP).normalize();

    // W/S 走"画面纵深"，A/D 走"画面左右"——都在水平面上，不会把人物往天上推
    if (farmInput.blocked) {
      keys.clear();
      player.cancelTarget();
    }
    if (keys.has("w") || keys.has("arrowup")) inputDir.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) inputDir.sub(forward);
    if (keys.has("d") || keys.has("arrowright")) inputDir.add(screenRight);
    if (keys.has("a") || keys.has("arrowleft")) inputDir.sub(screenRight);

    const state = useGame.getState();
    if (!farmInput.blocked) {
      inputDir.addScaledVector(screenRight, farmInput.x).addScaledVector(forward, farmInput.forward);
      if (farmInput.jump) player.jump();
    }
    farmInput.jump = false;
    player.update(dt, elapsed, inputDir.lengthSq() > 0 ? inputDir : null, keys.has("shift") || farmInput.running);
    const wallTime = Date.now();
    updatePlots(plots, state.plots, state.selectedPlot, wallTime, elapsed);

    const cameraBase = player.cameraGroundY - 0.87 * player.swimAmount;
    controls.update(player.positionRef, cameraBase, dt, Number(keys.has("e")) - Number(keys.has("q")));
    clockAcc += dt;
    if (clockAcc >= 0.5) {
      clockAcc = 0;
      tickClock();
    }

    // 阴影跟着人物走：整片方形地图铺不下 2048 的阴影贴图，只罩住人物周围
    view.keyLight.position.set(
      player.positionRef.x + 9.5,
      15,
      player.positionRef.z + 7.5
    );
    view.keyLight.target.position.set(player.positionRef.x, 0, player.positionRef.z);
    view.keyLight.target.updateMatrixWorld();
    const weather = weatherAt(wallTime);
    riverAudio.update(player.positionRef.x, player.positionRef.z, screenRight.x, screenRight.z, weather);
    view.updateWeather(weather);
    world.update(elapsed, weather, player.positionRef, player.swimAmount);
    view.renderer.render(view.scene, view.camera);
  };
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    controls.dispose();
    riverAudio.dispose();
    unsubscribeAppearance();
    world.dispose();
    player.dispose();
    disposePlots(plots);
    view.dispose();
  };

  return { dispose };
}
