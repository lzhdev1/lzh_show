import type { Atelier, V } from "./atelier";

export type ShoeStyle = "pump" | "ribbon" | "slipper" | "boot";

const tau = 2 * Math.PI;
const segments = 24;
const soleColor = 0x82665d;
const lining = 0x795a65;
const ring = (point: (theta: number) => V): V[] =>
  Array.from({ length: segments }, (_, i) => point(tau * i / segments));

// A closed, lightly asymmetric last. The ball of the foot is wider than the
// arch, and the toe points slightly towards the big toe on each mirrored shoe.
function shoe(a: Atelier, side: number, color: number, trim: number, style: ShoeStyle) {
  const center = side * .077;
  const heeled = style === "pump" || style === "boot";
  const heelLift = style === "pump" ? .027 : style === "boot" ? .021 : .004;
  const toeLength = style === "pump" ? .137 : style === "slipper" ? .132 : .128;
  function shape(theta: number, scale: number, extraY: number): V {
    const c = Math.cos(theta), s = Math.sin(theta);
    const forefoot = Math.exp(-((c - .53) ** 2) / .12);
    const width = .037 + .011 * forefoot - .004 * Math.max(0, -c);
    const belly = style === "ribbon" ? .83 : style === "pump" ? 1.13 : 1;
    const x = side * ((-.005 * Math.max(0, c) ** 2) + Math.sign(s) * width * Math.abs(s) ** belly * scale);
    const z = .019 + (c >= 0 ? toeLength - .019 : .101) * c * scale;
    const rise = heelLift * Math.max(0, Math.min(1, (.03 - z) / .075));
    return [center + x, .002 + rise + .004 * Math.max(0, c) ** 7 + extraY, z];
  }
  function opening(theta: number, expand: number, drop: number): V {
    const c = Math.cos(theta), s = Math.sin(theta);
    const collar = style === "boot" ? .093 : .068;
    return [center + side * (.034 + expand) * s,
      collar + (style === "boot" ? .002 * c : .014 * Math.max(0, -c) + .004 * c * c) - drop,
      -.025 + (.057 + expand) * c];
  }
  const bottom = ring(t => shape(t, .987, 0));
  const edge = ring(t => shape(t, 1.008, .005));
  const welt = ring(t => shape(t, 1.006, .008));
  const quarter = ring(t => {
    const c = Math.cos(t);
    return shape(t, .963, .021 + .009 * Math.max(0, -c));
  });
  const vamp = ring(t => {
    const outer = shape(t, .91, .032), rim = opening(t, .002, .005);
    const blend = .37;
    return [outer[0] * (1 - blend) + rim[0] * blend, outer[1] * (1 - blend) + rim[1] * blend + .006,
      outer[2] * (1 - blend) + rim[2] * blend];
  });
  const collarSeam = ring(t => opening(t, .0016, .0036));
  const collar = ring(t => opening(t, 0, 0));
  a.shell([bottom, edge], soleColor, "satin", "foot");
  a.shell([edge, welt], trim, "satin", "foot");
  a.shell([welt, quarter, vamp, collarSeam], color, "satin", "foot");
  a.shell([collarSeam, collar], trim, "satin", "foot");
  // Fold the lining inside the cut topline. The bottom cap closes the sole in a jump.
  a.shell([collar, ring(t => opening(t, -.005, .014))], lining, "satin", "foot");
  const floor: V = [center, .009, .034];
  const cap: V = [center, .027, -.026];
  a.shell([bottom, bottom.map(() => floor)], soleColor, "satin", "foot");
  a.shell([ring(t => opening(t, -.005, .014)), collar.map(() => cap)], lining, "satin", "foot");

  if (heeled) {
    const heel = (y: number, w: number, d: number) => Array.from({ length: 10 }, (_, i): V =>
      [center + w * Math.sin(i * tau / 10), y, -.056 + d * Math.cos(i * tau / 10)]);
    const foot = style === "pump" ? .010 : .020;
    a.shell([heel(.001, foot, foot * .83), heel(.006, foot + .001, foot * .85)], soleColor, "satin", "foot");
    a.shell([heel(.006, foot + .001, foot * .85), heel(heelLift + .006, .025, .021)], color, "satin", "foot");
    const base = heel(.001, foot, foot * .83);
    a.shell([base, base.map(() => [center, .001, -.056])], soleColor, "satin", "foot");
  }
  return center;
}

function satinBow(a: Atelier, center: V, width: number, color: number, trim: number) {
  const [x, y, z] = center;
  for (const side of [-1, 1]) {
    const rows: V[][] = [
      [[x, y, z], [x, y + .002, z + .003]],
      [[x + side * width * .58, y + .005, z - .005], [x + side * width * .60, y + .009, z + .003]],
      [[x + side * width, y + .004, z - .006], [x + side * width, y + .007, z + .007]],
      [[x + side * width * .62, y + .002, z - .003], [x + side * width * .62, y + .003, z + .003]],
    ];
    a.shell(rows, color, "satin", "foot", false);
  }
  a.gem(center, [.0055, .005, .006], trim, "metal", "foot");
}

function ankleRibbon(a: Atelier, center: number, winding: number, color: number) {
  const rows = Array.from({ length: 21 }, (_, i): V[] => {
    const t = i / 20, angle = winding * (t * tau * 1.12 - .92);
    const y = .072 + t * .105, z = -.023 - .015 * Math.min(1, t * 2);
    const w = .037 - .004 * Math.min(1, t * 2);
    const d = .058 - .018 * Math.min(1, t * 2);
    return [-1, 1].map(edge => [center + w * Math.sin(angle), y + edge * .0045, z + d * Math.cos(angle)]);
  });
  a.shell(rows, color, "satin", "leg", false);
}

function shortBoot(a: Atelier, side: number, center: number, color: number, trim: number) {
  const tiers = [
    [.075, .035, .054, -.025], [.105, .034, .050, -.031], [.138, .030, .041, -.037],
    [.175, .033, .043, -.038], [.206, .037, .044, -.038],
  ];
  const sections = tiers.map(([height, w, d, z], i) => ring(t => [
    center + side * w * Math.sin(t), height + (i === tiers.length - 1 ? .022 * Math.max(0, Math.cos(t)) ** 2 : 0), z + d * Math.cos(t),
  ]));
  a.shell(sections, color, "satin", "leg");
  const rim = sections[sections.length - 1];
  a.shell([rim.map(([x, y, z]) => [x, y - .005, z]), rim], trim, "metal", "leg");
  // A contrasting spat panel wraps the outside quarter and tapers to two tips.
  const spat = (y: number, base: number, arc: number, w: number, d: number) =>
    Array.from({ length: 7 }, (_, i): V => {
      const p = i / 6, angle = base + arc * p;
      return [center + side * w * Math.sin(angle), y + .009 * Math.sin(Math.PI * p), -.037 + d * Math.cos(angle)];
    });
  a.shell([spat(.116, .93, .38, .035, .046), spat(.159, .41, 1.21, .034, .044),
    spat(.194, .34, 1.35, .038, .046)], trim, "satin", "leg", false);
  a.gem([center + side * .034, .177, -.015], [.005, .006, .005], color, "metal", "leg");
}

export function buildDanceShoes(a: Atelier, color: number, trim: number, style: ShoeStyle): void {
  for (const side of [-1, 1]) {
    const center = shoe(a, side, color, trim, style);
    if (style === "boot") {
      shortBoot(a, side, center, color, trim);
    } else if (style === "ribbon") {
      ankleRibbon(a, center, 1, trim);
      ankleRibbon(a, center, -1, trim);
      a.gem([center, .178, .0025], [.006, .0055, .004], color, "satin", "leg");
      satinBow(a, [center, .065, .068], .015, trim, color);
    } else if (style === "slipper") {
      // Soft petal rosette on a flat satin slipper.
      for (let i = 0; i < 5; i++) {
        const angle = i * tau / 5;
        const petal = (r: number, w: number, lift: number): V[] => [-1, 0, 1].map(k => [
          center + r * Math.cos(angle) - k * w * Math.sin(angle),
          .060 - .34 * (r * Math.sin(angle) + k * w * Math.cos(angle)) + lift + Math.abs(k) * .0016,
          .079 + r * Math.sin(angle) + k * w * Math.cos(angle),
        ]);
        a.shell([petal(.001, .001, 0), petal(.011, .006, .004), petal(.018, .0025, .006)], trim, "satin", "foot", false);
      }
      a.gem([center, .065, .079], [.004, .004, .004], color, "metal", "foot");
    } else {
      // A Mary Jane strap crosses the instep from the inner quarter to a faceted buckle.
      const strap = (offset: number): V[] => [
        [center - side * .036, .062, .010 + offset], [center - side * .024, .076, .032 + offset],
        [center, .079, .043 + offset], [center + side * .025, .071, .033 + offset], [center + side * .036, .057, .021 + offset],
      ];
      a.shell([strap(-.004), strap(.004)], trim, "satin", "foot", false);
      a.gem([center + side * .032, .066, .026], [.005, .005, .007], color, "metal", "foot");
      satinBow(a, [center, .061, .082], .019, trim, color);
    }
  }
}
