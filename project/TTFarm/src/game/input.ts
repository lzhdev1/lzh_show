/** Analog input lives outside React so pointer motion never re-renders the HUD. */
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

export function releaseStick() {
  farmInput.x = 0;
  farmInput.forward = 0;
  farmInput.running = farmInput.sprint;
  farmInput.steering = false;
}

export function releaseTouchInput() {
  farmInput.x = 0;
  farmInput.forward = 0;
  farmInput.running = false;
  farmInput.steering = false;
  farmInput.jump = false;
  farmInput.sprint = false;
  farmInput.brake = false;
}
