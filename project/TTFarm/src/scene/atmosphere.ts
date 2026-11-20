import * as THREE from "three";

export type { WeatherKind as SkyWeather } from "../game/weather";

// A seamless panorama of painted cloud banks, drawn once. The shader handles the
// sky gradient, weather tint and slow drift without rendering volumetric clouds.
function cloudAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  for (let k = 0; k < 24; k++) {
    const x = ((k * 367) % 1024), y = 102 + ((k * 71) % 115);
    const scale = 0.55 + ((k * 37) % 53) / 50;
    for (const wrap of [-1024, 0, 1024]) {
      const cx = x + wrap;
      for (let j = 0; j < 5; j++) {
        const h = (8 + 14 * Math.sin((j + 0.5) * Math.PI / 5)) * scale;
        const bx = cx + (j-2)*14*scale;
        const by = y + (j%2)*4*scale;
        ctx.fillStyle = "#b6c2cb";
        ctx.beginPath(); ctx.ellipse(bx, by+3*scale, 21*scale, h, 0, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = "#fff6e8";
        ctx.beginPath(); ctx.ellipse(bx, by-2*scale, 20*scale, h*.83, 0, 0, 2*Math.PI); ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSky() {
  const atlas = cloudAtlas();
  const uniforms = {clouds:{value:atlas}, weather:{value:0}, t:{value:0}};
  const material = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, depthTest:false, uniforms,
    vertexShader:`
      varying vec3 dir;
      void main() {
        dir = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix)*position,1.);
        gl_Position = clip.xyww;
      }`,
    fragmentShader:`
      uniform sampler2D clouds; uniform float weather; uniform float t; varying vec3 dir;
      void main() {
        vec3 n = normalize(dir);
        float h = clamp(n.y,0.,1.);
        vec3 horizon = mix(vec3(.80,.89,.83),vec3(.47,.59,.63),weather);
        vec3 high = mix(vec3(.22,.55,.80),vec3(.20,.31,.40),weather);
        vec3 sky = mix(horizon, high, smoothstep(-.08,.84,h));
        float azimuth = atan(n.z,n.x)*.15915494;
        vec4 cloud = texture2D(clouds,vec2(azimuth+t*.00065, clamp(h*1.15+.12,0.,1.)));
        sky = mix(sky, cloud.rgb*mix(vec3(1.),vec3(.51,.62,.69),weather),
          cloud.a * smoothstep(-.03,.095,n.y)* (.74 + .24*weather));
        gl_FragColor = vec4(sky,1.);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), material);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  return { sky, uniforms, dispose() {sky.geometry.dispose(); material.dispose(); atlas.dispose();} };
}

export function buildRain() {
  const count = window.matchMedia("(pointer: coarse)").matches ? 260 : 520;
  const starts = new Float32Array(count*6), ends = new Float32Array(count*2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random()-.5)*42, y = Math.random()*18, z = (Math.random()-.5)*42;
    starts.set([x,y,z,x,y,z],i*6);
    ends[i*2+1] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(starts,3));
  geometry.setAttribute("tip", new THREE.BufferAttribute(ends,1));
  const uniforms = { t:{value:0}, center:{value:new THREE.Vector2()} };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false,
    vertexShader:`
      uniform float t; uniform vec2 center; attribute float tip; varying float opacity;
      void main() {
        float y = mod(position.y-t*10.,18.);
        vec2 drift = vec2(.17,.055)*(18.-y);
        vec2 offset = mod(position.xz+drift-center+21.,42.)-21.;
        vec3 p = vec3(center.x+offset.x - tip*.055,y + tip*.32,center.y+offset.y);
        opacity = (1.-smoothstep(14.,21.,length(offset)))*smoothstep(0.,.65,y);
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`
      varying float opacity;
      void main() {
        gl_FragColor=vec4(.71,.83,.87,.52*opacity);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.LineSegments(geometry,material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, update(t:number, player?: THREE.Vector3) {
    uniforms.t.value = t;
    if (player) uniforms.center.value.set(player.x,player.z);
  }};
}
