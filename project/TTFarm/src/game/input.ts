/** Analog input lives outside React so pointer motion never re-renders the HUD. */
export const farmInput = { x: 0, forward: 0, running: false, steering: false, jump: false, blocked: true };

export function releaseStick() {
  farmInput.x = 0;
  farmInput.forward = 0;
  farmInput.running = false;
  farmInput.steering = false;
}

export function releaseTouchInput() {
  releaseStick();
  farmInput.jump = false;
}
