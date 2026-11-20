import type { Atelier, Bind, Fabric, V } from "./atelier";

const tau = Math.PI * 2;
const silver = 0xdce9f5, paleGold = 0xffda9a;
type Side = -1 | 1;
type Profile = [height: number, width: number, depth: number];
const sides = [-1, 1] as const;

function point(x: number, y: number, z: number, side: Side): V {
  return [side * x, y, z];
}

function dye(first: number, last: number, t: number) {
  let color = 0;
  for (const shift of [16, 8, 0]) {
    const start = (first >> shift) & 255, end = (last >> shift) & 255;
    color |= Math.round(start + (end - start) * t) << shift;
  }
  return color;
}

/** A bias-cut panel can rotate around the body as it flares towards its hem. */
function panel(a: Atelier, profile: Profile[], from: number, to: number, twist: number,
  cut: (u: number, angle: number) => number, tint: number | [number, number], fabric: Fabric, trim?: number) {
  const count = Math.max(10, Math.ceil(Math.abs(to - from) * 7));
  const rows = profile.map(([y, w, d], i) => Array.from({ length: count + 1 }, (_, j): V => {
    const u = j / count, v = i / (profile.length - 1);
    const theta = from + (to - from) * u + twist * v;
    return [w * Math.sin(theta), y + v * v * cut(u, theta), .002 + d * Math.cos(theta)];
  }));
  if (typeof tint === "number") {
    a.shell(rows, tint, fabric, "skirt", false);
  } else {
    for (let j = 0; j < count; j++) {
      const color = dye(tint[0], tint[1], (j + .5) / count);
      a.shell(rows.map(row => row.slice(j, j + 2)), color, fabric, "skirt", false);
    }
  }
  if (trim !== undefined) a.tube(rows[rows.length - 1], .0026, trim, "metal", "skirt");
}

function oneShoulder(a: Atelier, side: Side, color: number, edge: number) {
  const body: Profile[] = [[.924, .146, .125], [.978, .137, .128], [1.032, .122, .118],
    [1.083, .132, .120], [1.143, .146, .133], [1.174, .147, .129]];
  const rings = body.map(([y, w, d]) => Array.from({ length: 40 }, (_, i): V => {
    const angle = tau * i / 40;
    return [w * Math.sin(angle), y, .003 + d * Math.cos(angle)];
  }));
  const rim = rings[0].map((_, i): V => {
    const theta = tau * i / 40, rise = (1 + side * Math.sin(theta)) / 2;
    return [.148 * Math.sin(theta), 1.181 + .116 * rise ** 1.3,
      -.005 + (.118 - .045 * rise) * Math.cos(theta)];
  });
  a.shell([...rings, rim], color, "satin", "torso");
  a.tube([...rim, rim[0]], .0032, edge, "metal", "torso");
}

function sleeve(a: Atelier, side: Side, shape: [number, number][], color: number, cuff: number) {
  const rows = shape.map(([x, r]) => Array.from({ length: 22 }, (_, i): V => {
    const t = tau * i / 22;
    return [x * side, 1.274 + r * Math.sin(t), -.025 + .94 * r * Math.cos(t)];
  }));
  a.shell(rows, color, "satin", "arm");
  const end = rows[rows.length - 1];
  a.tube([...end, end[0]], .003, cuff, "metal", "arm");
}

function jacket(a: Atelier, profile: [number, number, number, number][], tint: number) {
  const rows = profile.map(([y, w, d, opening]) => Array.from({ length: 43 }, (_, i): V => {
    const angle = opening + (tau - 2 * opening) * i / 42;
    return [w * Math.sin(angle), y, -.002 + d * Math.cos(angle)];
  }));
  a.shell(rows, tint, "satin", "torso", false);
  return rows;
}

type BustLine = [y: number, w: number, d: number, from: number, to: number, tilt: number];

/** A curved front panel follows the bust even through the hollow of the waist. */
function corsetPanel(a: Atelier, side: Side, profile: BustLine[], color: number, finish: Fabric) {
  const rows = profile.map(([y, w, d, from, to, tilt]) => Array.from({ length: 15 }, (_, i): V => {
    const u = i / 14, angle = from + (to - from) * u;
    return [side * w * Math.sin(angle), y + tilt * u, .005 + d * Math.cos(angle)];
  }));
  a.shell(rows, color, finish, "torso", false);
  return rows;
}

function crescent(a: Atelier, p: V, radius: number, angle: number, color: number, bind: Bind) {
  const rows = Array.from({ length: 21 }, (_, i) => {
    const t = Math.PI * i / 20, spread = Math.sin(t);
    return [0, .48, 1].map((f): V => {
      const x = radius * (.35 - (1.26 - f * .62) * spread);
      return [p[0] + x * Math.cos(angle), p[1] + radius * Math.cos(t),
        p[2] - x * Math.sin(angle) + radius * .15 * Math.sin(Math.PI * f) * spread];
    });
  });
  a.shell(rows, color, "metal", bind, false);
}

function lunar(a: Atelier) {
  const twilight = 0x647eaa, mist = 0xaac8df, silk = 0xcddde8, glass = 0xdaedff;
  oneShoulder(a, -1, mist, silver);
  a.skirt({ waist: .969, hem: .48, width: .22, depth: .159, color: twilight,
    pleats: 4, slant: .125, wave: .003 });
  // Gathered near the high hip, the satin crosses the front and falls ankle-length behind.
  panel(a, [[.966, .148, .134], [.862, .187, .151], [.714, .188, .159], [.54, .216, .175],
    [.338, .248, .206]], .58, 6.35, -.76,
    (u, t) => .23 * u ** 4 + .077 * Math.sin(t) - .038 * (1 - Math.cos(t)), mist, "satin", silver);
  panel(a, [[.956, .151, .137], [.852, .19, .156], [.69, .213, .166], [.511, .252, .197]],
    .58, 2.19, -.92, u => .145 * (1 - u) ** 2 - .054 * u, silk, "tulle", silver);
  // The cowl is cut as one broad fold, from the right waist to the crescent clasp.
  const cowl: V[][] = [
    [[.142, 1.065, .050], [.134, 1.102, .072], [.13, 1.135, .084]],
    [[.061, 1.105, .127], [.048, 1.145, .148], [.045, 1.174, .133]],
    [[-.05, 1.166, .128], [-.057, 1.205, .137], [-.059, 1.222, .111]],
    [[-.124, 1.243, .066], [-.134, 1.268, .063], [-.133, 1.285, .041]],
  ];
  a.shell(cowl, silk, "satin", "torso", false);
  crescent(a, [-.133, 1.279, .047], .049, -.53, silver, "torso");
  const stole: V[][] = [
    [[-.128, 1.272, -.037], [-.15, 1.274, -.039], [-.171, 1.267, -.042]],
    [[-.114, 1.19, -.099], [-.174, 1.188, -.107], [-.209, 1.172, -.124]],
    [[-.102, 1.064, -.148], [-.158, 1.066, -.169], [-.217, 1.036, -.178]],
    [[-.115, .91, -.195], [-.147, .873, -.217], [-.192, .826, -.222]],
  ];
  a.shell(stole, silk, "tulle", "torso", false);
  a.tube(stole.map(row => row[2]), .0024, silver, "metal", "torso");
  a.gem([.125, .976, .065], [.013, .018, .01], glass, "glow", "torso");
  crescent(a, [.095, 1.549, .053], .047, .64, silver, "head");
  a.tube([[.117, 1.513, .05], [.123, 1.483, .052], [.122, 1.461, .05]], .0024, silver, "metal", "head");
  a.gem([.122, 1.454, .05], [.006, .013, .006], glass, "glow", "head");
  a.shoes(twilight, silver, "ribbon");
}

function nocturne(a: Atelier) {
  const velvet = 0x45314f, lilac = 0xb8a3c7, satin = 0x78627f, ivory = 0xf0e2db;
  a.bodice(ivory, paleGold, "jewel");
  a.skirt({ waist: 1.017, hem: .736, width: .2, depth: .16, color: lilac, pleats: 7, wave: .004 });
  const coat = jacket(a, [[.927, .158, .137, .47], [.979, .145, .139, .18],
    [1.049, .134, .137, .21], [1.136, .151, .151, .37], [1.203, .153, .143, .54],
    [1.254, .156, .107, .61], [1.291, .135, .079, .47]], velvet);
  a.tube(coat[0], .0028, satin, "satin", "torso");
  for (const s of sides) {
    // Long shawl lapels open over an ivory shirt. Each has a separate return at its notch.
    const lapel = [
      [point(.035, 1.298, .061, s), point(.098, 1.292, .060, s)],
      [point(.040, 1.253, .106, s), point(.132, 1.246, .079, s)],
      [point(.045, 1.227, .133, s), point(.090, 1.221, .118, s)],
      [point(.048, 1.211, .145, s), point(.117, 1.211, .108, s)],
      [point(.026, 1.069, .142, s), point(.05, 1.105, .143, s)],
    ];
    a.shell(lapel, satin, "satin", "torso", false);
    sleeve(a, s, [[.128, .039], [.158, .065], [.21, .061], [.31, .047], [.405, .041],
      [.491, .036]], velvet, lilac);
    sleeve(a, s, [[.491, .036], [.514, .035]], ivory, paleGold);
    panel(a, [[.988, .145, .136], [.879, .176, .154], [.749, .201, .167], [.505, .206, .197]],
      s * 1.32, s * 3.095, s * .02, u => .23 * (1 - u) ** 3 + .083 * u ** 8,
      velvet, "satin", satin);
  }
  a.ring([[.965, .149, .136, .003], [1.002, .141, .134, .004]], satin, "satin", "torso");
  a.pearl([0, .994, .142], [.01, .01, .005], paleGold, "metal", "torso");
  a.bow([0, 1.281, .07], .043, velvet, "torso");
  // A soft beret with a visible crown and tilted leather band.
  const hat = (r: number, y: number, offset: number) => Array.from({ length: 32 }, (_, i): V => {
    const t = tau * i / 32, x = r * Math.sin(t), z = r * .87 * Math.cos(t);
    return [x + offset, y + .28 * x + .11 * z, z - .017];
  });
  a.shell([hat(.107, 1.522, -.005), hat(.118, 1.546, -.018), hat(.13, 1.575, -.027),
    hat(.094, 1.608, -.034), hat(.003, 1.623, -.036)], lilac, "satin", "head");
  a.shell([hat(.109, 1.521, -.005), hat(.118, 1.543, -.017)], velvet, "satin", "head");
  a.gem([-.087, 1.539, .068], [.017, .009, .006], paleGold, "metal", "head");
  a.shoes(velvet, satin, "boot");
}

function prism(a: Atelier) {
  const iris = 0x9189c6, aqua = 0x8ed8cd, opal = 0xe2e0ee, dusk = 0xbba7d1;
  a.bodice(iris, silver, "halter");
  a.skirt({ hem: .662, width: .222, depth: .174, color: iris, pleats: 5, slant: -.063, wave: .004 });
  const skirt: Profile[] = [[.955, .15, .135], [.855, .188, .156], [.759, .218, .179], [.626, .252, .204]];
  panel(a, skirt, -.65, 2.94, -.8, (u, t) => .105 * Math.sin(t) + .057 * u ** 4,
    [aqua, opal], "satin", silver);
  panel(a, skirt, 2.94, 5.64, -.8, (u, t) => .105 * Math.sin(t) - .056 * Math.sin(u * Math.PI),
    [opal, dusk], "satin", silver);
  // The folded organza lobes share a clasp between the shoulder blades.
  // Skinning them to the torso keeps the pleats open through each arm swing.
  const upper: V[] = [[.052, 1.227, -.125], [.105, 1.296, -.142], [.194, 1.337, -.157],
    [.276, 1.347, -.173], [.316, 1.333, -.187], [.291, 1.296, -.195],
    [.244, 1.249, -.204], [.179, 1.208, -.201], [.123, 1.186, -.175]];
  const lower: V[] = [[.123, 1.186, -.175], [.198, 1.192, -.207], [.244, 1.174, -.22],
    [.221, 1.126, -.219], [.168, 1.067, -.205], [.116, 1.025, -.189], [.080, 1.052, -.164]];
  for (const s of sides) {
    const origin = point(.047, 1.178, -.112, s);
    for (const [rim, tone] of [[upper, aqua], [lower, dusk]] as const) {
      const rows = [.06, .42, .75, 1].map(v => rim.map(([x,y,z],i): V => [
        origin[0] + (s*x - origin[0]) * v, origin[1] + (y-origin[1]) * v,
        origin[2] + (z-origin[2]) * v - .022 * Math.sin(v*Math.PI) * Math.sin(i*1.48),
      ]));
      a.shell(rows, tone, "tulle", "torso", false);
      a.tube(rows[3], .0032, tone, "metal", "torso");
      a.tube(rows.map(row => row[3]), .0023, opal, "metal", "torso");
    }
    // Faceted bust panels frame the central notch.
    corsetPanel(a, s, [[1.048,.128,.12,.18,.68,.034], [1.094,.143,.129,.12,1.06,.008],
      [1.158,.151,.135,.05,1.21,.007], [1.181,.15,.131,.05,1.21,.018],
      [1.214,.134,.114,.57,1.06,.005]], s === 1 ? aqua : opal, "satin");
  }
  a.gem([0, 1.184, -.116], [.023, .03, .012], aqua, "glow", "torso");
  a.gem([.105, 1.535, .056], [.013, .028, .013], aqua, "metal", "head");
  a.shoes(iris, silver, "slipper");
}

function meteor(a: Atelier) {
  const graphite = 0x394050, chrome = 0xb5c8dc, blue = 0x637db0, hotPink = 0xe69bbc, white = 0xe2e6ef;
  a.bodice(graphite, chrome, "jewel");
  // A mirrored V corset is visible in the opening of the cropped jacket.
  for (const s of sides) {
    const breastplate = corsetPanel(a, s, [[.977,.141,.133,.015,1.05,.045],
      [1.039,.128,.125,.015,1.12,.018], [1.096,.142,.133,.016,1.15,.004],
      [1.154,.155,.141,.02,1.14,.006], [1.189,.15,.135,.07,1.12,.026]], chrome, "metal");
    a.tube(breastplate[4], .0027, white, "metal", "torso");
  }
  a.skirt({ waist: .999, hem: .724, width: .225, color: graphite, pleats: 14, wave: .003 });
  // Each box pleat has a broad face and a narrow, contrasting inverted return.
  for (let i = 0; i < 14; i++) {
    const start = tau * i / 14, end = tau * (i + 1) / 14;
    const pleat = (y: number, w: number, d: number, opening: number) => [
      [start, .91], [start + .15 * (end - start), 1], [end - opening, 1], [end, .91],
    ].map(([t,r]): V => [w * r * Math.sin(t), y, .003 + d * r * Math.cos(t)]);
    const rows = [pleat(.967, .156, .139, .028), pleat(.852, .209, .169, .056),
      pleat(.712, .252, .203, .071)];
    a.shell(rows.map(row => row.slice(0, 3)), i % 4 === 1 ? chrome : blue, "satin", "skirt", false);
    a.shell(rows.map(row => row.slice(2)), graphite, "satin", "skirt", false);
  }
  const bolero = jacket(a, [[1.103,.147,.149,.69], [1.125,.157,.155,.65],
    [1.201,.159,.146,.58], [1.258,.161,.105,.69], [1.29,.136,.078,.73]], blue);
  a.tube(bolero[0], .006, hotPink, "satin", "torso");
  for (const s of sides) {
    sleeve(a,s,[[.131,.043],[.164,.069],[.21,.074],[.314,.061],[.415,.058],[.486,.062],[.507,.041]], blue, hotPink);
    sleeve(a,s,[[.505,.041],[.536,.038]],graphite,chrome);
    a.shell([[point(.063,1.288,.061,s),point(.132,1.281,.042,s)],
      [point(.068,1.231,.126,s),point(.145,1.224,.075,s)],
      [point(.089,1.199,.13,s),point(.142,1.212,.09,s)]],white,"satin","torso",false);
  }
  a.ring([[.961,.155,.137,.003],[.985,.151,.136,.003]],graphite,"satin","torso");
  a.gem([-.058,.977,.134],[.026,.017,.007],hotPink,"glow","torso");
  // Sleek over-ear monitors continue the jacket's chrome / candy stripe.
  const arc=Array.from({length:25},(_,i):V=>{
    const t=Math.PI*i/24;
    return [.116*Math.cos(t),1.498+.119*Math.sin(t),-.006];
  });
  a.tube(arc,.006,chrome,"metal","head");
  for(const s of sides){
    a.pearl(point(.11,1.497,.001,s),[.021,.034,.031],graphite,"satin","head");
    a.gem(point(.127,1.499,.004,s),[.009,.023,.022],hotPink,"metal","head");
  }
  a.shoes(graphite,chrome,"boot");
}

function dusk(a: Atelier) {
  const wine = 0x803f54, vermilion = 0xc97065, amber = 0xf2b17c, apricot = 0xf5ceb1;
  oneShoulder(a, 1, wine, paleGold);
  a.skirt({ hem: .53, width: .215, depth:.165, color: wine, pleats: 4, slant: -.085, wave:.003 });
  // A second shoulder fold continues the spiral from the waist around the ribs.
  const sash: V[][] = [
    [[-.13,1.025,.065],[-.133,1.066,.061],[-.123,1.099,.074]],
    [[-.063,1.056,.124],[-.069,1.107,.14],[-.061,1.143,.137]],
    [[.034,1.12,.139],[.02,1.164,.149],[.038,1.201,.13]],
    [[.095,1.192,.11],[.093,1.23,.105],[.107,1.262,.07]],
    [[.126,1.251,.07],[.132,1.277,.052],[.126,1.298,.027]],
  ];
  a.shell(sash,apricot,"satin","torso",false);
  const steps = 84;
  const hem = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, theta = -1.48 + tau * 1.34 * t;
    const ease = Math.sin(Math.PI * t) ** .75;
    const r = .151 + .069 * t, d = .134 + .039 * t, y = .966 - .403 * t;
    const spread = .013 + (.053 + .061 * t) * ease;
    const spill = .018 + (.089 + .06 * t) * ease;
    const flute = (1 + .18 * Math.cos(7 * theta)) * spread;
    return [0, .44, .78, 1].map((v): V => [
      (r + v * flute) * Math.sin(theta), y - v * spill + .018 * Math.sin(Math.PI * v),
      (d + v * flute * .73) * Math.cos(theta) + .003,
    ]);
  });
  for (let i = 0; i < steps; i += 3) {
    const color = dye(amber, vermilion, (i + 1.5) / steps);
    a.shell(hem.slice(i, i + 4), color, "satin", "skirt", false);
  }
  a.tube(hem.map(row => row[3]), .003, paleGold, "metal", "skirt");
  // A folded silk rosette is seen above the shoulder from either side.
  for(let i=0;i<3;i++){
    const phi=(i-1)*.52;
    const blade=[.06,.46,.82,1].map(v=>[-1,0,1].map((w):V=>[
      .135+.064*v*Math.cos(phi)+w*.018*Math.sin(Math.PI*v)*Math.sin(phi),
      1.259+(.047+.029*i)*v+w*.014*Math.sin(Math.PI*v),
      -.007+.064*v*Math.sin(phi)+w*.025*Math.sin(Math.PI*v)*Math.cos(phi),
    ]));
    a.shell(blade,i===1?apricot:vermilion,"satin","torso",false);
  }
  a.gem([.141,1.269,.019],[.014,.015,.01],paleGold,"metal","torso");
  for(const rot of [-.45,.47]){
    const orbit=Array.from({length:33},(_,i):V=>{
      const t=tau*i/32,x=.042*Math.cos(t),y=.023*Math.sin(t);
      return [.097+x*Math.cos(rot)-y*Math.sin(rot),1.552+x*Math.sin(rot)+y*Math.cos(rot),.053-.42*x];
    });
    a.tube(orbit,.003,paleGold,"metal","head");
  }
  a.gem([.123,1.558,.052],[.009,.016,.009],amber,"glow","head");
  a.shoes(wine,paleGold,"pump");
}

export function buildAstral(a: Atelier, id: string): void {
  switch (id) {
    case "lunar-arc": lunar(a); break;
    case "violet-nocturne": nocturne(a); break;
    case "aurora-prism": prism(a); break;
    case "meteor-idol": meteor(a); break;
    case "dusk-orbit": dusk(a); break;
  }
}
