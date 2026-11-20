import * as THREE from "three";
import { RIVER_BED, RIVER_POINTS, riverBedHeight } from "./layout";

/** Tileable distance-to-cell-border atlas. Only two filtered texture reads per
 * fragment are needed for drifting caustics, including when viewed from afar. */
function currentAtlas() {
  const cells = 5, size = 192;
  const seeds: THREE.Vector2[] = [];
  for (let i = 0; i < cells * cells; i++) {
    seeds.push(new THREE.Vector2(.14 + .72 * ((i * 71 + 18) % 101) / 101,
      .16 + .68 * ((i * i * 17 + i * 53 + 5) % 107) / 107));
  }
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size, v = py / size;
      const x = u * cells + .25 * Math.sin(v * Math.PI * 4) + .19 * Math.cos((u+v)*Math.PI*4);
      const y = v * cells + .31 * Math.cos((u-v)*Math.PI*2) + .16 * Math.sin(u*Math.PI*6);
      const gx = Math.floor(x), gy = Math.floor(y);
      let a = Infinity, b = Infinity;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const cx = gx + i, cy = gy + j;
          const seed = seeds[((cy+cells) % cells) * cells + ((cx+cells) % cells)];
          const dx = cx + seed.x - x, dy = cy + seed.y - y;
          const d = dx*dx + dy*dy;
          if (d < a) { b = a; a = d; } else if (d < b) b = d;
        }
      }
      const border = Math.sqrt(b) - Math.sqrt(a);
      const ii = (py * size + px) * 4;
      data[ii] = Math.round(255 * Math.exp(-230 * border * border));
      data[ii+1] = Math.round(255 * Math.exp(-24 * a));
      const noise = Math.sin(px*13.3+py*71.9)*2395.232;
      data[ii+2] = Math.round((noise-Math.floor(noise))*255);
      data[ii+3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function buildSubmergedDetails(valley: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
                                      time: { value: number }, cloud: { value: number }) {
  const atlas = currentAtlas();
  const pebbleMaterial = new THREE.MeshStandardMaterial({ roughness: .71 });
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .87, side: THREE.DoubleSide });
  // Warp the visible bed in camera space using the apparent depth through water
  // (Snell's law with IOR 1.333). Animated wave slopes bend submerged outlines.
  // This is a single-pass approximation local to the riverbed and pebbles.
  for (const material of [valley.material, pebbleMaterial, grassMaterial]) {
    material.customProgramCacheKey = () => material === grassMaterial ? "river-grass" : "river-bed";
    material.onBeforeCompile = shader => {
      shader.uniforms.riverTime = time;
      shader.uniforms.cloudCover = cloud;
      shader.uniforms.currentAtlas = { value: atlas };
      if (material === grassMaterial) {
        shader.vertexShader = "attribute vec3 currentBend;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
          #include <begin_vertex>
          transformed += currentBend * sin(position.x*.92 + position.z*.63 - riverTime*1.57);`);
      }
      shader.vertexShader = "uniform float riverTime; varying vec3 bedPosition;\n" + shader.vertexShader.replace(
        "#include <project_vertex>", `
          #include <project_vertex>
          vec4 localBed = vec4(transformed,1.);
          #ifdef USE_INSTANCING
            localBed = instanceMatrix * localBed;
          #endif
          bedPosition = (modelMatrix * localBed).xyz;
          float depth = max(0., ${RIVER_BED.waterY.toFixed(3)} - bedPosition.y);
          vec3 eye = normalize(cameraPosition - bedPosition);
          float c = max(.06,eye.y);
          float depthRatio = clamp(c*inversesqrt(.777 + c*c),.46,.80);
          vec2 bend = vec2(cos(dot(bedPosition.xz,vec2(.83,1.41))-riverTime*1.34),
                           sin(dot(bedPosition.xz,vec2(1.68,-.76))-riverTime*1.61));
          vec3 shift = depth*vec3(.044*bend.x, 1.-depthRatio, .044*bend.y);
          mvPosition.xyz += mat3(viewMatrix)*shift;
          gl_Position = projectionMatrix*mvPosition;
          // Refraction changes the image of the bottom. Keep its depth test
          // on the physical bed along this viewing ray so it cannot hide a swimmer's legs.
          if (depth > 0. && gl_Position.w > 0.) {
            float rayScale = (cameraPosition.y - bedPosition.y)
              / max(.05, cameraPosition.y - bedPosition.y - shift.y);
            vec4 realDepth = projectionMatrix * vec4(mvPosition.xyz * clamp(rayScale, 1., 2.2), 1.);
            gl_Position.z = (realDepth.z / realDepth.w) * gl_Position.w;
          }
        `
      );
      shader.fragmentShader = "uniform float riverTime; uniform float cloudCover; uniform sampler2D currentAtlas; varying vec3 bedPosition;\n" +
        shader.fragmentShader.replace("#include <color_fragment>", `
          #include <color_fragment>
          float immersion = smoothstep(0., .24, ${RIVER_BED.waterY.toFixed(3)} - bedPosition.y);
          if (immersion > 0.) {
            vec2 p = bedPosition.xz;
            float t = riverTime;
            vec2 distortion = .023 * vec2(sin(dot(p,vec2(.93,1.21))-t*1.1),
                                           cos(dot(p,vec2(1.31,-.57))-t*1.27));
            vec2 coords = p * .32 + distortion;
            vec3 a = texture2D(currentAtlas, coords + vec2(-.025,.019)*t).rgb;
            float b = texture2D(currentAtlas, mat2(.92,.39,-.39,.92)*coords*1.14 + vec2(.015,.009)*t).r;
            float caustic = min(a.r,b)*.95 + a.r*.23;
            float fade = 1.-smoothstep(22.,65.,length(cameraPosition-bedPosition));
            float sand = sin(p.x*1.23+p.y*.62+sin(p.y*1.04)) * cos(p.y*.95-p.x*.42);
            diffuseColor.rgb *= 1. + immersion*((a.b-.5)*.11 + (a.g-.15)*.19 + sand*.105);
            diffuseColor.rgb += vec3(.40,.52,.37) * caustic * immersion * fade * (1.-.82*cloudCover);
          }
        `);
    };
  }

  // Rounded stones of several sizes form clustered gravel bars. Leave gaps for
  // fine sand and room at the edge for the reeds and floating leaves.
  const details = new THREE.Group();
  details.name = "submerged-riverbed";
  const compact = window.matchMedia("(pointer: coarse)").matches;
  const stoneGeometry = new THREE.IcosahedronGeometry(1, compact ? 0 : 1);
  stoneGeometry.setAttribute("normal", stoneGeometry.getAttribute("position").clone());
  const stoneColors = [0xaaa58f,0xac9781,0x607e78,0x989b85,0xd2b99a,0x616b66];
  const stone = new THREE.Object3D(), tint = new THREE.Color();
  const blades: number[] = [], bladeColors: number[] = [], bends: number[] = [], indices: number[] = [];
  const bladeShade = new THREE.Color(0x426b51), bladeTip = new THREE.Color(0x97b775);
  let seed = 48151;
  const random = () => (seed = seed*16807 % 2147483647) / 2147483647;
  function ribbon(x: number, y: number, z: number, tx: number, tz: number, length: number) {
    const vert = blades.length/3;
    const width = .024 + random()*.029;
    const curl = .13 + random()*.14;
    for (let row = 0; row <= 4; row++) {
      const h = row/4;
      const lean = .65*length*h*h;
      const twist = Math.sin(h*Math.PI*1.35)*curl;
      tint.copy(bladeShade).lerp(bladeTip, h*.84);
      for (const side of [-1,1]) {
        const w = twist + side*width*(1.-h*.85);
        blades.push(x+tx*lean-tz*w, y+length*(h-.25*h*h), z+tz*lean+tx*w);
        bends.push(tx*.12*h*h + tz*.03*h, -.022*h*h, tz*.12*h*h - tx*.03*h);
        bladeColors.push(tint.r,tint.g,tint.b);
      }
      if (row) {
        const v = vert + row*2;
        indices.push(v-2, v-1, v, v-1, v+1, v);
      }
    }
  }
  // Stones are binned in short reaches: a camera in the yard does not have to
  // draw all the stones at the distant mountain ends. Reuse the same geometry.
  const perBar = compact ? 9 : 13, barsPerBatch = 5;
  const flushGrass = () => {
    if (!blades.length) return;
    const leaves = new THREE.BufferGeometry();
    leaves.setAttribute("position", new THREE.Float32BufferAttribute(blades, 3));
    leaves.setAttribute("color", new THREE.Float32BufferAttribute(bladeColors, 3));
    leaves.setAttribute("currentBend", new THREE.Float32BufferAttribute(bends, 3));
    leaves.setIndex(indices);
    leaves.computeVertexNormals();
    const weed = new THREE.Mesh(leaves, grassMaterial);
    weed.receiveShadow = true;
    details.add(weed);
    blades.length = bladeColors.length = bends.length = indices.length = 0;
  };
  let gravel: THREE.InstancedMesh | null = null;
  for (let i = 1; i < RIVER_POINTS.length-1; i += 2) {
    if (!gravel || gravel.count === perBar * barsPerBatch) {
      flushGrass();
      gravel = new THREE.InstancedMesh(stoneGeometry, pebbleMaterial, perBar * barsPerBatch);
      gravel.count = 0;
      gravel.receiveShadow = true;
      details.add(gravel);
    }
    const p = RIVER_POINTS[i], next = RIVER_POINTS[i+1];
    const length = p.distanceTo(next);
    const tx = (next.x - p.x) / length, tz = (next.z - p.z) / length;
    const bar = (random()-.5)*10.4;
    for (let j = 0; j < perBar; j++) {
      const u = (random()-.5)*4.2;
      const v = THREE.MathUtils.clamp(bar + (random()-.5)*3.7, -6.7, 6.7);
      const radius = j === 0 ? .36 + .26*random() : .075 + .20*random();
      stone.position.set(p.x + tx*u - tz*v, riverBedHeight(Math.abs(v)) + radius*.10, p.z + tz*u + tx*v);
      stone.scale.set(radius*(1.15+.56*random()), radius*(.34+.20*random()), radius);
      stone.rotation.set(.18*random(),6.28*random(),.13*random());
      stone.updateMatrix();
      gravel.setMatrixAt(gravel.count,stone.matrix);
      gravel.setColorAt(gravel.count,tint.setHex(stoneColors[Math.floor(random()*stoneColors.length)]));
      gravel.count++;
      if (j === 0 || j === 5) {
        for (let leaf = 0; leaf < 8; leaf++) {
          const angle = (random()-.5)*1.9, c = Math.cos(angle), s = Math.sin(angle);
          ribbon(stone.position.x + (random()-.5)*.49, riverBedHeight(Math.abs(v))-.035,
            stone.position.z + (random()-.5)*.49, tx*c-tz*s, tx*s+tz*c,
            (.35+random()*.62)*Math.min(1, (7-Math.abs(v))*.35));
        }
      }
    }
  }
  flushGrass();
  return { details, dispose: () => atlas.dispose() };
}
