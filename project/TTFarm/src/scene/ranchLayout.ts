export const RANCH_ENTRANCE = { x: -7.5, z: 19.1 };
export const GATE_WIDTH = 3.2;

/** The gate stays put as levels extend the pasture west and south. */
export function ranchBounds(level: number) {
  return { east: -3.6, north: 20.8, west: -13.2 - (level - 1) * 1.45,
    south: 28.3 + (level - 1) * 1.05 };
}

const largest = ranchBounds(10);
export function onRanchReserve(x: number, z: number, margin = 1.3) {
  return x >= largest.west - margin && x <= largest.east + margin
    && z >= largest.north - margin && z <= largest.south + margin;
}
