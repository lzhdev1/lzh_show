import * as THREE from "three";
import { WEATHER, isRainy, type WeatherKind } from "../game/weather";
import { RIVER_BED, RIVER_POINTS } from "./layout";

// Metres in river coordinates (downstream, across). Values are height and its two
// spatial derivatives, so the displaced silhouette and the reflection tilt agree.
const waves = `
  vec3 swell(vec2 p, float t) {
    vec3 phase = vec3(dot(p, vec2(1.34, .73)) - t * 1.32,
                      dot(p, vec2(.89, -1.61)) - t * .94,
                      dot(p, vec2(2.21, .42)) - t * 1.84);
    vec3 amplitude = vec3(.045, .028, .014);
    vec3 slope = amplitude * cos(phase);
    return vec3(dot(amplitude, sin(phase)), dot(slope, vec3(1.34,.89,2.21)),
                dot(slope, vec3(.73,-1.61,.42)));
  }
`;

function flowGeometry(first: number, last: number, tangents: THREE.Vector3[],
                      distanceAt: number[], across: number, along: number) {
  const positions: number[] = [], uv: number[] = [], axes: number[] = [], indices: number[] = [];
  const tangent = new THREE.Vector3(), center = new THREE.Vector3();
  const rowWidth = across + 1;
  for (let i = first; i < last; i++) {
    const a = RIVER_POINTS[i], b = RIVER_POINTS[i + 1];
    const length = a.distanceTo(b);
    const rows = i === last - 1 ? along + 1 : along;
    for (let j = 0; j < rows; j++) {
      const fraction = j / along;
      center.lerpVectors(a, b, fraction);
      tangent.lerpVectors(tangents[i], tangents[i + 1], fraction).normalize();
      for (let k = 0; k <= across; k++) {
        const side = (k / across * 2 - 1) * RIVER_BED.waterLine;
        positions.push(center.x - tangent.z * side, RIVER_BED.waterY, center.z + tangent.x * side);
        axes.push(tangent.x, tangent.z);
        uv.push(distanceAt[i] + fraction * length, side);
        if (i - first + j > 0 && k > 0) {
          const n = ((i - first) * along + j) * rowWidth + k;
          indices.push(n - rowWidth - 1, n - rowWidth, n - 1, n - 1, n - rowWidth, n);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("streamAxis", new THREE.Float32BufferAttribute(axes, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += 0.10;
  return geometry;
}

export function buildWaterSurface() {
  const time = { value: 0 }, rain = { value: 0 }, cloud = { value: 0 };
  // Four recent strokes disturb the same reflective surface as the current.
  const strokes = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -10, 0));
  const headings = strokes.map(() => new THREE.Vector2());
  const wake = { value: new THREE.Vector3(0, 0, 0) };
  let nextStroke = 0, lastStroke = -10;
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff, specular: 0xffffff, shininess: 220,
    transparent: true, depthWrite: false,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { riverTime: time, rainAmount: rain, cloudCover: cloud,
      swimStrokes: { value: strokes }, strokeHeadings: { value: headings }, wakeCenter: wake });
    const common = `
      uniform float riverTime;
      varying vec2 riverUV;
      varying vec2 riverAxis;
      varying vec3 waterPosition;
      ${waves}
    `;
    shader.vertexShader = common + "attribute vec2 streamAxis;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", `
        #include <begin_vertex>
        riverUV = uv;
        riverAxis = streamAxis;
        float shore = 1. - smoothstep(5.5, 7., abs(uv.y));
        transformed.y += swell(uv, riverTime).x * shore;
        waterPosition = (modelMatrix * vec4(transformed, 1.)).xyz;
      `
    );
    shader.fragmentShader = common + `
      uniform float rainAmount;
      uniform float cloudCover;
      uniform vec4 swimStrokes[4];
      uniform vec2 strokeHeadings[4];
      uniform vec3 wakeCenter;
      float dropHash(vec2 p) { return fract(sin(dot(p, vec2(17.39, 73.73))) * 3413.53); }
    ` + shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      float t = riverTime;
      vec3 viewRay = normalize(cameraPosition - waterPosition);
      vec2 axis = normalize(riverAxis);
      vec2 across = vec2(-axis.y, axis.x);
      float shore = 1. - smoothstep(5.5, 7., abs(riverUV.y));
      float closeDetail = 1. - smoothstep(22., 76., length(cameraPosition-waterPosition));
      vec2 slope = swell(riverUV, t).yz;
      vec2 detail = vec2(4.6, 1.8) * .015 * cos(dot(riverUV, vec2(4.6,1.8)) - t*2.9 + .7*sin(riverUV.y*.93))
                  + vec2(2.7,-5.2) * .010 * cos(dot(riverUV, vec2(2.7,-5.2)) - t*2.2 + .59*cos(riverUV.x*1.2))
                  + vec2(5.3,6.3) * .0035 * cos(dot(riverUV, vec2(5.3,6.3)) - t*3.4);
      slope += detail * closeDetail;
      if (rainAmount > .01 && closeDetail > .01) {
        vec2 p = riverUV * .89;
        vec2 cell = floor(p);
        vec2 center = .31 + .38 * vec2(dropHash(cell), dropHash(cell+13.2));
        vec2 d = fract(p) - center;
        float radius = length(d);
        float age = fract(t * 1.05 + dropHash(cell-5.6));
        float offset = radius - age * .32;
        float front = exp(-1000. * offset * offset);
        slope += .22 * (1.-age) * front * sin(offset*94.) * d / max(radius,.001) * rainAmount * closeDetail;
      }
      slope *= .25 + .75*shore;
      vec2 worldSlope = slope.x * axis + slope.y * across;
      float wakeLight = 0.;
      vec2 relative = waterPosition.xz - wakeCenter.xy;
      if (wakeCenter.z > .5 && dot(relative, relative) < 36.) {
        for (int i = 0; i < 4; i++) {
          vec2 d = waterPosition.xz - swimStrokes[i].xy;
          float age = t - swimStrokes[i].z;
          float r = length(d);
          float offset = r - (.18 + age * .75);
          float width = .08 + age * .035;
          float envelope = exp(-offset*offset / (width*width))
            * (1.-smoothstep(.15, 1.85, age)) * swimStrokes[i].w;
          vec2 outward = d / max(.02,r);
          envelope *= 1. - .76 * smoothstep(-.25,.85,dot(outward,strokeHeadings[i]));
          worldSlope += outward * sin(offset * 29.) * envelope * .19;
          wakeLight += envelope * .058;
        }
      }
      vec3 waterNormal = normalize(vec3(-worldSlope.x, 1., -worldSlope.y));
      normal = normalize(mat3(viewMatrix) * waterNormal);
    `).replace("#include <opaque_fragment>", `
      float cosView = clamp(dot(viewRay, waterNormal), 0., 1.);
      float fresnel = .032 + .83 * pow(1. - cosView, 4.);
      float depth = ${(RIVER_BED.waterY - RIVER_BED.bedY).toFixed(3)} * clamp((7.-abs(riverUV.y)) / 4.4, 0., 1.);
      float pathLength = depth / max(.28, viewRay.y);
      float absorption = 1.-exp(-pathLength*.36);
      vec3 reflection = reflect(-viewRay, waterNormal);
      float skyHeight = smoothstep(-.12,.72,reflection.y);
      vec3 reflectedSky = mix(vec3(.74,.93,.95), vec3(.22,.55,.85), skyHeight);
      float cloudBand = sin(reflection.z*17.+reflection.x*8.+t*.01) + sin(reflection.y*38.+reflection.x*12.);
      reflectedSky += smoothstep(.9,1.6,cloudBand)*.16;
      reflectedSky = mix(reflectedSky, vec3(.48,.61,.68), cloudCover*.70);
      vec3 body = mix(vec3(.055,.53,.53), vec3(.018,.31,.37), smoothstep(.08,1.1,depth));
      body = mix(body, body*vec3(.72,.76,.89), cloudCover);
      float alpha = fresnel + (1.-fresnel)*absorption;
      vec3 radiance = fresnel * reflectedSky + (1.-fresnel) * absorption * body;
      float rim = 6.86 + .063*sin(riverUV.x*1.17-t*.81) + .029*sin(riverUV.x*2.94+t*.62);
      float edgeLine = 1.-smoothstep(.012,.032+fwidth(riverUV.y),abs(abs(riverUV.y)-rim));
      float lapping = edgeLine * smoothstep(-.35,.79,sin(riverUV.x*.91-t*.61)) * closeDetail * .30;
      radiance += vec3(.70,.88,.80) * (lapping + wakeLight);
      alpha += (1.-alpha) * min(1., lapping + wakeLight);
      // The three.js specular term sees the actual sun direction and bridge shadow map.
      vec3 highlight = min(vec3(.83), reflectedLight.directSpecular * .38);
      radiance += highlight;
      alpha = max(alpha, clamp(max(highlight.r, highlight.b),0.,.88));
      outgoingLight = radiance / max(.015,alpha);
      diffuseColor.a = clamp(alpha, .015, .98);
      #include <opaque_fragment>
    `);
  };
  const distanceAt = [0];
  const tangents = RIVER_POINTS.map((p, i) => {
    if (i) distanceAt[i] = distanceAt[i - 1] + p.distanceTo(RIVER_POINTS[i - 1]);
    return new THREE.Vector3().subVectors(RIVER_POINTS[Math.min(i + 1, RIVER_POINTS.length - 1)],
      RIVER_POINTS[Math.max(0, i - 1)]).normalize();
  });
  const compact = window.matchMedia("(pointer: coarse)").matches;
  const tiles: THREE.Mesh[] = [];
  for (let first = 0; first < RIVER_POINTS.length - 1; first += 16) {
    const end = Math.min(first + 16, RIVER_POINTS.length - 1);
    const tile = new THREE.Mesh(flowGeometry(first, end, tangents, distanceAt, compact ? 10 : 14, compact ? 3 : 4), material);
    tile.name = "river-surface";
    tile.receiveShadow = true;
    tiles.push(tile);
  }

  return {
    tiles,
    time,
    cloud,
    update(t: number, weather: WeatherKind, player?: THREE.Vector3, swimAmount = 0) {
      const dt = Math.max(0, Math.min(.15, t - time.value));
      time.value = t;
      rain.value = THREE.MathUtils.damp(rain.value, isRainy(weather) ? 1 : 0, 2.4, dt);
      const overcast = WEATHER[weather].cover;
      cloud.value = THREE.MathUtils.damp(cloud.value, overcast, 1.6, dt);
      if (player && swimAmount > .12) {
        const previous = strokes[(nextStroke + strokes.length - 1) % strokes.length];
        const distance = Math.hypot(player.x - previous.x, player.z - previous.y);
        if (t - lastStroke >= (distance > .15 ? .40 : .77)) {
          const heading = headings[nextStroke];
          if (distance > .15 && t - lastStroke < 1.85)
            heading.set(player.x - previous.x, player.z - previous.y).divideScalar(distance);
          else heading.set(0, 0);
          strokes[nextStroke].set(player.x, player.z, t, swimAmount * (distance > .15 ? 1 : .54));
          nextStroke = (nextStroke + 1) % strokes.length;
          lastStroke = t;
          wake.value.set(player.x, player.z, 1);
        }
      }
      if (t - lastStroke > 1.85) wake.value.z = 0;
    },
  };
}
