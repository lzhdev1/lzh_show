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
  const uniforms = {clouds:{value:atlas}, weather:{value:0}, haze:{value:0}, lightning:{value:0}, t:{value:0}};
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
      uniform sampler2D clouds; uniform float weather; uniform float haze; uniform float lightning; uniform float t; varying vec3 dir;
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
        sky = mix(sky, vec3(.72,.80,.81), haze * (.9 - .35*h));
        if (lightning > .001) {
          float direction = fract(azimuth*3. + floor(t/13.)*.382);
          float segment=h*22., band=floor(segment);
          float jag=mix(sin(band*2.61),sin((band+1.)*2.61),fract(segment));
          float zigzag=.475+h*.11+jag*.018;
          float mainBolt=1.-smoothstep(.0012,.004,abs(direction-zigzag));
          float branch=1.-smoothstep(.0007,.0028,abs(direction-zigzag-.28*(.24-h)));
          float strike=max(mainBolt,branch*(1.-smoothstep(.23,.24,h))*smoothstep(.12,.15,h))
              *smoothstep(.04,.12,h)*(1.-smoothstep(.39,.48,h));
          sky += lightning * (vec3(.10,.09,.16) + strike*vec3(.8,.88,1.));
        }
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
  const uniforms = { t:{value:0}, strength:{value:1}, center:{value:new THREE.Vector2()} };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false,
    vertexShader:`
      uniform float t; uniform float strength; uniform vec2 center; attribute float tip; varying float opacity;
      void main() {
        float y = mod(position.y-t*10.,18.);
        vec2 drift = vec2(.17,.055)*(18.-y)*strength;
        vec2 offset = mod(position.xz+drift-center+21.,42.)-21.;
        vec3 p = vec3(center.x+offset.x - tip*.055*strength,y + tip*.32*strength,center.y+offset.y);
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
  return { mesh, update(t:number, player?: THREE.Vector3, strength = 1) {
    uniforms.t.value = t;
    uniforms.strength.value = strength;
    if (player) uniforms.center.value.set(player.x,player.z);
  }};
}

/** 一次绘制随人物移动的雪花或疾风落叶，粒子运动全部留在 GPU。 */
export function buildWindAndSnow() {
  const count = matchMedia("(pointer: coarse)").matches ? 210 : 390;
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
  const uniforms = { t: {value: 0}, wind: {value: 0}, center: {value: new THREE.Vector2()}, pixelScale: {value: 180} };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float t,wind,pixelScale; uniform vec2 center;
      varying float seed,alpha; varying vec2 axis;
      void main() {
        seed=position.z;
        float angle=t*(.65+seed)+position.y*18.;
        axis=vec2(cos(angle),sin(angle));
        float y=mod(position.y*13.-t*(.76+seed),13.);
        vec2 origin=position.xz*31. + vec2(t*(.42+wind*5.), .55*sin(angle));
        vec2 offset=mod(origin-center+15.5,31.)-15.5;
        y=mix(y,y*.48+.55*sin(angle+offset.x*.4)+.65,wind);
        vec4 mv=viewMatrix*vec4(center.x+offset.x,y,center.y+offset.y,1.);
        alpha=(1.-smoothstep(10.,15.5,length(offset)))*smoothstep(.0,.65,y);
        gl_Position=projectionMatrix*mv;
        float curl=wind*float(seed<.20);
        gl_PointSize=clamp(pixelScale*(.40+seed*.45+wind*.36+curl*1.6)/max(1.,-mv.z),2.,54.);
      }`,
    fragmentShader: `
      uniform float wind; varying float seed,alpha; varying vec2 axis;
      void main() {
        vec2 p=gl_PointCoord-.5;
        if(wind<.5 || seed>=.20) p=vec2(dot(p,axis),dot(p,vec2(-axis.y,axis.x)));
        float r=length(p), shape; vec3 ink;
        if(wind>.5 && seed<.20){
          float line=abs(p.y-.09*sin(p.x*7.));
          float tail=abs(p.y-.09*sin(p.x*7.)+.074);
          shape=max(1.-smoothstep(.007,.030,line),.54*(1.-smoothstep(.005,.02,tail)));
          shape*=1.-smoothstep(.12,.48,abs(p.x));
          ink=vec3(.78,.94,.83);
        } else if(wind>.5){
          float ridge=p.y+.05*sin(p.x*7.);
          shape=1.-smoothstep(.83,1.,abs(p.x)*2.7+abs(ridge)*7.4);
          ink=mix(vec3(.51,.71,.21),vec3(.97,.74,.28),seed);
          ink+=.27*(1.-smoothstep(.005,.022,abs(ridge)));
        } else {
          float a=abs(cos(atan(p.y,p.x)*3.));
          shape=(1.-smoothstep(.33,.48,r))*max(1.-smoothstep(.05,.17,r), smoothstep(.78,.99,a));
          ink=vec3(.83,.94,1.);
        }
        if(alpha*shape<.025)discard;
        gl_FragColor=vec4(ink,.94*shape*alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, update(t: number, wind: boolean, player?: THREE.Vector3) {
    uniforms.t.value = t;
    uniforms.wind.value = Number(wind);
    uniforms.pixelScale.value = Math.min(250, window.innerHeight*.31);
    if (player) uniforms.center.value.set(player.x, player.z);
    geo.setDrawRange(0, wind ? Math.ceil(count*.45) : count);
  }};
}
