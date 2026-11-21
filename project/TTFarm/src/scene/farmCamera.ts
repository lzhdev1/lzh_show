import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";
import { farmInput } from "../game/input";
import { GATE_GAP, WORLD_HALF } from "./layout";

const HOME = new Spherical().setFromVector3(new Vector3(9.4, 2.9, 4.8));

interface Contact {
  x: number;
  y: number;
  startX: number;
  startY: number;
  started: number;
  tap: boolean;
  zoomDrag: boolean;
}

/** Each contact belongs to the element where it started. A joystick or jump
 * contact never participates in orbit, pinch, or scene picking. */
export function createFarmCamera(canvas: HTMLCanvasElement, camera: PerspectiveCamera, onTap: (e: PointerEvent) => void) {
  const current = HOME.clone();
  const goal = HOME.clone();
  const focus = new Vector3();
  const contacts = new Map<number, Contact>();
  const events = new AbortController();
  const { signal } = events;
  let touring = false;

  function zoom(factor: number) {
    goal.radius = MathUtils.clamp(goal.radius * factor, 5.5, 320);
  }

  function reset() {
    goal.copy(HOME);
    if (touring) goal.set(22, 0.76, 0.44);
    current.copy(goal);
  }

  function press(e: PointerEvent) {
    if (farmInput.blocked || (e.button !== 0 && e.button !== 1 && e.button !== 2)) return;
    const single = contacts.size === 0;
    for (const other of contacts.values()) other.tap = false;
    contacts.set(e.pointerId, {
      startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      started: performance.now(), tap: single && e.button === 0 && !farmInput.steering,
      zoomDrag: e.pointerType === "mouse" && e.button === 1,
    });
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function move(e: PointerEvent) {
    const p = contacts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dragged = Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >= 6;
    if (p.tap && !dragged && !farmInput.steering) return;
    p.tap = false;
    if (!farmInput.blocked && contacts.size === 1) {
      if (p.zoomDrag) zoom(Math.exp(dy * 0.012));
      else {
        const sensitivity = 2 * Math.PI * 0.75 / Math.max(1, canvas.clientHeight);
        goal.theta -= dx * sensitivity;
        goal.phi = MathUtils.clamp(goal.phi - dy * sensitivity, 0.16, 1.47);
      }
    } else if (!farmInput.blocked && contacts.size === 2) {
      for (const other of contacts.values()) {
        if (other === p) continue;
        const before = Math.hypot(p.x - other.x, p.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (before > 3 && after > 3) zoom(before / after);
      }
    }
    p.x = e.clientX;
    p.y = e.clientY;
  }

  function end(e: PointerEvent) {
    const p = contacts.get(e.pointerId);
    if (!p) return;
    contacts.delete(e.pointerId);
    if (e.type === "pointerup" && p.tap && !farmInput.blocked && !farmInput.steering &&
        performance.now() - p.started < 650 && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 6) {
      onTap(e);
    }
  }

  function clear() {
    for (const id of contacts.keys()) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    contacts.clear();
  }

  canvas.addEventListener("pointerdown", press, { signal });
  canvas.addEventListener("pointermove", move, { signal });
  canvas.addEventListener("pointerup", end, { signal });
  canvas.addEventListener("pointercancel", end, { signal });
  canvas.addEventListener("lostpointercapture", end, { signal });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
  canvas.addEventListener("wheel", (e) => {
    if (farmInput.blocked) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    zoom(Math.exp(MathUtils.clamp(e.deltaY * unit * 0.0015, -1, 1)));
  }, { passive: false, signal });
  canvas.addEventListener("dblclick", () => { if (!farmInput.blocked) reset(); }, { signal });
  window.addEventListener("ttfarm:reset-camera", reset, { signal });
  window.addEventListener("blur", clear, { signal });
  window.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) {
      for (const contact of contacts.values()) contact.tap = false;
    }
  }, { signal, capture: true });
  document.addEventListener("visibilitychange", clear, { signal });

  return {
    reset,
    tour(enabled: boolean) { touring = enabled; clear(); reset(); },
    update(player: Vector3, groundHeight: number, dt: number, keyTurn: number) {
      if (farmInput.blocked && contacts.size > 0) clear();
      goal.theta += keyTurn * dt * 1.8;
      current.theta = MathUtils.damp(current.theta, goal.theta, 29, dt);
      current.phi = MathUtils.damp(current.phi, goal.phi, 29, dt);
      current.radius = MathUtils.damp(current.radius, goal.radius, 20, dt);
      // Follow the slope and bridge ramps without copying a jumping head's vertical motion.
      const eyeLevel = groundHeight + 1.1;
      focus.set(player.x, dt > 0 ? MathUtils.damp(focus.y, eyeLevel, 8, dt) : eyeLevel, player.z);
      camera.position.setFromSpherical(current).add(focus);
      const cam = camera.position;
      const limit = WORLD_HALF + 6;
      const far = Math.max(Math.abs(cam.x), Math.abs(cam.z));
      if (!(cam.z > 0 && Math.abs(cam.x) < GATE_GAP) && far > limit && cam.y < 42) {
        cam.x *= limit / far;
        cam.z *= limit / far;
      }
      camera.lookAt(focus);
    },
    dispose() { clear(); events.abort(); },
  };
}
