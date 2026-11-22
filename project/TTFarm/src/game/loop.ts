import * as THREE from "three";
import { createRiverAudio } from "../scene/riverAudio";
import { createFarmCamera } from "../scene/farmCamera";
import { createView } from "../scene/view";
import { createWorld } from "../scene/world";
import { createRanchScene } from "../scene/ranchScene";
import { RANCH_ENTRANCE } from "../scene/ranchLayout";
import { saddleHeight } from "../scene/ranchAnimals";
import { createPlots, disposePlots, plotIdAt, plotPosition, updatePlots, PLOT_SIZE, bedHeightAt } from "../scene/plots";
import { createForageScene } from "../scene/forageScene";
import { createTown } from "../scene/town/townScene";
import { townSurfaceHeight } from "../scene/town/townLayout";
import { Player } from "../scene/player";
import { createFarmPeers } from "../scene/farmPeers";
import { createHorseTrail } from "../scene/horseTrail";
import { WORLD_HALF } from "../scene/layout";
import { ranchBounds } from "../scene/ranchLayout";
import { createChatBubble } from "../scene/chatBubble";
import { bubbleText } from "./chat";
import { useAccount } from "./account";
import { setLocalPresence, useSocial } from "./social";
import { useAction } from "./actionStore";
import { ACTIONS, ACTION_IDS, isActionId } from "../scene/actionMotion";
import { useGame } from "./state";
import { setStandingPlot } from "./fieldInteraction";
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
  const town = createTown(world.obstacles);
  view.scene.add(town.group);
  const ranchScene = createRanchScene(world.obstacles);
  view.scene.add(ranchScene.group);

  const plots = createPlots();
  view.scene.add(plots.group);
  const forageScene = createForageScene(world.obstacles, plots.library);
  view.scene.add(forageScene.group);

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
      const id = plotIdAt(x, z);
      if (id !== null) {
        const p = centers[id];
        const active = useSocial.getState().visit?.state ?? useGame.getState();
        return TERRACE_TOP + bedHeightAt((x - p.x) / PLOT_HALF, (z - p.z) / PLOT_HALF, active.plots[id]?.unlocked);
      }
      return TERRACE_TOP;
    }
    // 河东小城的铺装比草地略高，走上去要抬脚
    const townH = townSurfaceHeight(x, z);
    if (townH > 0) return townH;
    return 0;
  };
  const player = new Player(initial.avatarId, world.obstacles, fieldHeightAt, initial.outfitId, initial.bottomId);
  view.scene.add(player.root);
  const localBubble = createChatBubble();
  localBubble.sprite.position.set(0, 1.86, 0);
  player.root.add(localBubble.sprite);
  const peers = createFarmPeers(world.obstacles, fieldHeightAt, ranchScene.animalLibrary);
  view.scene.add(peers.group);
  const horseTrail = createHorseTrail();
  view.scene.add(horseTrail.mesh);
  let trailHorseId: string | undefined;
  const spectatorFocus = new THREE.Vector3();
  let roomKey = "home";
  let homePose = { x: 0, z: 6.9, yaw: Math.PI, deck: false };

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
  const actionKeys = new Map(ACTION_IDS.map(id => [ACTIONS[id].key.toLowerCase(), id]));
  const isSpectating = () => useSocial.getState().visit?.mode === "spectate";

  // —— 键盘 ——
  const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
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
    const actionId = actionKeys.get(key);
    if (actionId) {
      if (!e.repeat && !isSpectating()) player.playAction(actionId);
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

  // The panel closes after choosing a destination. Start walking on the first
  // unblocked frame so dismissing the panel cannot cancel the new route.
  let destination: "ranch" | "wild" | "forage" | null = null;
  const visitRanch = () => { destination = "ranch"; };
  const findWildlife = () => { destination = "wild"; };
  const findForage = () => { destination = "forage"; };
  const entrance = new THREE.Vector3(RANCH_ENTRANCE.x, 0, RANCH_ENTRANCE.z);
  window.addEventListener("ttfarm:visit-ranch", visitRanch);
  window.addEventListener("ttfarm:find-wildlife", findWildlife);
  window.addEventListener("ttfarm:find-forage", findForage);
  const onActionEvent = (event: Event) => {
    const id = (event as CustomEvent).detail;
    if (!isSpectating() && isActionId(id)) player.playAction(id);
  };
  const onStopActionEvent = () => player.stopAction();
  window.addEventListener("ttfarm:action", onActionEvent);
  window.addEventListener("ttfarm:stop-action", onStopActionEvent);
  const focusVisit = (event: Event) => {
    const visit = useSocial.getState().visit;
    if (!visit) return;
    const ranch = (event as CustomEvent<string>).detail === "ranch";
    if (visit.mode === "spectate") {
      const bounds = ranchBounds(visit.state.ranch.level);
      spectatorFocus.set(ranch ? (bounds.east + bounds.west) / 2 : 0, 0, ranch ? (bounds.north + bounds.south) / 2 : 0);
    } else {
      player.moveTo(ranch ? entrance : centers[0], undefined, false, true);
    }
  };
  window.addEventListener("ttfarm:visit-focus", focusVisit);

  // —— 指针 ——
  const updatePointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  function handleClick(e: PointerEvent) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, view.camera);

    const visit = useSocial.getState().visit;
    if (visit?.mode === "spectate") {
      const surface = raycaster.intersectObjects(world.walkSurfaces, false)[0];
      if (surface) spectatorFocus.copy(surface.point);
      return;
    }
    const state = useGame.getState();
    if (state.selectedPlot !== null) state.selectPlot(null);
    const animal = ranchScene.pickWild(raycaster);
    if (animal) {
      player.moveTo(animal, undefined, false, true);
      return;
    }
    const patch = forageScene.pickPatch(raycaster);
    if (patch) {
      player.moveTo(patch, undefined, false, true);
      return;
    }
    const plotHits = raycaster.intersectObjects(plots.meshes, false);
    if (plotHits.length > 0) {
      const id = plotHits[0].object.userData.plotId as number;
      player.moveTo(centers[id], () => {
        const current = useGame.getState();
        if (!useSocial.getState().visit && current.plots[id]?.unlocked === false) current.selectPlot(id);
      });
      return;
    }

    // 地面和桥面一起参与拾取：点在桥上就落在桥面上，不会打穿到桥下的地面
    const groundHits = raycaster.intersectObjects(world.walkSurfaces, false);
    if (groundHits.length > 0) {
      const hit = groundHits[0];
      player.moveTo(hit.point, undefined, hit.object.name.startsWith("bridge-"));
    }
  }

  const unsubscribeAppearance = useGame.subscribe((state, previous) => {
    if (state.avatarId !== previous.avatarId || state.outfitId !== previous.outfitId || state.bottomId !== previous.bottomId) {
      player.setAppearance(state.avatarId, state.outfitId, state.bottomId);
    }
  });
  let lastDecor = initial.decor;
  let nextPresence = 0;

  // —— 主循环 ——
  let raf = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let growthTime = 0;
  let ranchLevel = initial.ranch.level;

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
    const dt = THREE.MathUtils.clamp((nowMs - lastTime) / 1000, 0, 0.1);
    lastTime = nowMs;
    elapsed += dt;
    const { visit, players, visitOnFoot } = useSocial.getState();
    const sceneState = visit?.state ?? useGame.getState();
    const spectator = visit?.mode === "spectate";
    const nextRoom = visit ? visit.mode + "/" + visit.ownerId : "home";
    if (roomKey !== nextRoom) {
      if (roomKey === "home") homePose = { x: player.positionRef.x, z: player.positionRef.z, yaw: player.root.rotation.y, deck: player.onBridgeDeck };
      roomKey = nextRoom;
      keys.clear(); releaseTouchInput(); destination = null;
      setStandingPlot(null); useGame.getState().selectPlot(null); peers.clear();
      horseTrail.clear();
      controls.tour(spectator); spectatorFocus.set(0, 0, 0);
      if (visit) player.relocate(0, 8.5, Math.PI);
      else player.relocate(homePose.x, homePose.z, homePose.yaw, homePose.deck);
      player.root.visible = !spectator;
      nextPresence = 0;
    }
    if (sceneState.decor !== lastDecor) {
      world.setDecor(sceneState.decor);
      lastDecor = sceneState.decor;
    }

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

    if (!farmInput.blocked) {
      if (destination) {
        const goal = destination === "ranch" ? entrance : destination === "wild" ? ranchScene.nearestWildPoint() : forageScene.nearestPatchPoint();
        if (goal) player.moveTo(goal, undefined, false, true);
        else useGame.getState().notify(destination === "forage" ? "这一批野菜已经被采完了，稍后再来看看" : "这批野生动物已全部收服，稍后再来看看");
        destination = null;
      }
      inputDir.addScaledVector(screenRight, farmInput.x).addScaledVector(forward, farmInput.forward);
      if (farmInput.jump && !spectator) player.jump();
    }
    farmInput.jump = false;
    const herd = sceneState.ranch;
    const ownHerd = useGame.getState().ranch;
    const mount = !spectator && !(visit && visitOnFoot) && ownHerd.ridingId ? ownHerd.animals.find(a => a.id === ownHerd.ridingId) : undefined;
    const seat = mount ? saddleHeight(mount.species) : 0;
    const animatedSeat=mount && (visit ? peers : ranchScene).seatHeight(mount.id);
    player.setSaddleHeight(animatedSeat ?? seat, mount?.species);
    if (spectator) {
      spectatorFocus.addScaledVector(inputDir.clampLength(0, 1), dt * (keys.has("shift") || farmInput.running ? 22 : 11));
      spectatorFocus.x = THREE.MathUtils.clamp(spectatorFocus.x, -WORLD_HALF, WORLD_HALF);
      spectatorFocus.z = THREE.MathUtils.clamp(spectatorFocus.z, -WORLD_HALF, WORLD_HALF);
    } else {
      player.update(dt, elapsed, inputDir.lengthSq() > 0 ? inputDir : null, keys.has("shift") || farmInput.running);
      const selfId = String(useAccount.getState().user?.id ?? "");
      localBubble.set(selfId ? bubbleText(selfId) : null);
      localBubble.tick(nowMs);
      const currentAction = player.currentAction;
      if (useAction.getState().current !== currentAction) useAction.setState({ current: currentAction });
      if (elapsed >= nextPresence) {
        nextPresence = elapsed + .08;
        const { x, y, z } = player.root.position;
        setLocalPresence({ x,y,z, yaw:player.root.rotation.y, moving:player.isMoving, running:player.isRunning,
          jumping:player.isJumping, swimming:player.swimAmount > .45,
          action:player.currentAction, actionTime:player.actionClock,
          mount:mount ? {species:mount.species,element:mount.element} : null });
      }
    }
    if (mount && player.swimAmount > 0.35) {
      const game = useGame.getState();
      if (visit) useSocial.setState({ visitOnFoot:true });
      else game.setRiding(null);
      game.notify(visit ? "水变深了，已下坐骑" : "水变深了，坐骑已回到牧场");
    }
    const onHorse = mount?.species === "horse" && player.swimAmount <= .35;
    if (onHorse && trailHorseId !== mount.id) {
      horseTrail.clear();
      trailHorseId = mount.id;
    }
    horseTrail.update(elapsed, player.root.position, player.root.rotation.y, onHorse && player.isRunning);
    const state = useGame.getState();
    const tile = !spectator && player.isOnFoot ? plotIdAt(player.positionRef.x, player.positionRef.z) : null;
    const standingPlot = tile !== null && sceneState.plots[tile]?.unlocked ? tile : null;
    setStandingPlot(standingPlot);
    const inspectedPlot = standingPlot === null && state.selectedPlot === tile ? state.selectedPlot : null;
    if (inspectedPlot !== state.selectedPlot) {
      state.selectPlot(null);
    }
    const wallTime = Date.now();
    const rider = !visit ? "local" : players.some(p => p.id === visit.ownerId && p.mount) ? "peer" : "stable";
    const focus = spectator ? spectatorFocus : player.positionRef;
    peers.update(players, dt, elapsed, focus);
    peers.localRide(visit?.mode === "friend" ? mount : undefined, player, dt, elapsed);
    ranchScene.update(elapsed, dt, wallTime, herd, player.root, player.isMoving, rider, spectator ? spectatorFocus : undefined, peers.emitAuras, player.isRunning);
    forageScene.update(elapsed, wallTime, useGame.getState().forage, focus, !visit);
    if (ranchLevel !== herd.level) {
      if (!spectator) player.adjustToChangedFences();
      ranchLevel = herd.level;
    }
    if (wallTime - growthTime >= 500 || wallTime < growthTime) {
      growthTime = wallTime;
      tickClock(growthTime);
    }
    updatePlots(plots, sceneState.plots, standingPlot ?? inspectedPlot, growthTime, elapsed);

    const cameraBase = player.cameraGroundY - 0.87 * player.swimAmount + Math.max(0, seat - 0.6);
    controls.update(focus, spectator ? fieldHeightAt(focus.x, focus.z) : cameraBase, dt, Number(keys.has("e")) - Number(keys.has("q")));

    // 阴影跟着人物走：整片方形地图铺不下 2048 的阴影贴图，只罩住人物周围
    view.keyLight.position.set(
      focus.x + 9.5,
      15,
      focus.z + 7.5
    );
    view.keyLight.target.position.set(focus.x, 0, focus.z);
    view.keyLight.target.updateMatrixWorld();
    const weather = weatherAt(wallTime);
    riverAudio.update(focus.x, focus.z, screenRight.x, screenRight.z, weather);
    view.updateWeather(weather);
    world.update(elapsed, weather, focus, spectator ? 0 : player.swimAmount);
    town.update(dt, elapsed);
    view.renderer.render(view.scene, view.camera);
  };
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    cancelAnimationFrame(raf);
    setStandingPlot(null);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("ttfarm:visit-ranch", visitRanch);
    window.removeEventListener("ttfarm:find-wildlife", findWildlife);
    window.removeEventListener("ttfarm:find-forage", findForage);
    window.removeEventListener("ttfarm:action", onActionEvent);
    window.removeEventListener("ttfarm:stop-action", onStopActionEvent);
    window.removeEventListener("ttfarm:visit-focus", focusVisit);
    controls.dispose();
    riverAudio.dispose();
    unsubscribeAppearance();
    peers.clear();
    horseTrail.dispose();
    ranchScene.dispose();
    forageScene.dispose();
    town.dispose();
    world.dispose();
    player.dispose();
    disposePlots(plots);
    view.dispose();
  };

  return { dispose };
}
