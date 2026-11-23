/**
 * Analog input lives outside React so pointer motion never re-renders the HUD.
 * Sprint is a deliberate toggle, so it is kept in a tiny external store:
 * the button label and the movement loop always read the same flag.
 */
export const farmInput = {
  x: 0,
  forward: 0,
  running: false,
  steering: false,
  jump: false,
  blocked: true,
  sprint: false,
  brake: false,
};

const sprintListeners = new Set<() => void>();

export function sprintEnabled() {
  return farmInput.sprint;
}

export function subscribeSprint(listener: () => void) {
  sprintListeners.add(listener);
  return () => { sprintListeners.delete(listener); };
}

export function setSprintEnabled(on: boolean) {
  if (farmInput.sprint === on) return;
  farmInput.sprint = on;
  farmInput.running = on;
  for (const listener of sprintListeners) listener();
}

export function releaseStick() {
  farmInput.x = 0;
  farmInput.forward = 0;
  farmInput.running = farmInput.sprint;
  farmInput.steering = false;
}

export function releaseTouchInput() {
  farmInput.x = 0;
  farmInput.forward = 0;
  // 冲刺是显式开关：面板/失焦只松开摇杆，不能把已开启的冲刺悄悄降回常速。
  farmInput.running = farmInput.sprint;
  farmInput.steering = false;
  farmInput.jump = false;
  farmInput.brake = false;
}
