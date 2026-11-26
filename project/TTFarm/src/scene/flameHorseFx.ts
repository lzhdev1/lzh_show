import * as THREE from "three";

/**
 * 焰纹神驹的专属外观。
 *
 * 不新增骨架，直接复用 professionalModels/horse.glb 的马体、鬃毛与尾毛：
 * 1. 马体改为黑曜石底，叠加会呼吸的熔岩裂纹自发光；
 * 2. 鬃毛与尾毛保留原模型已有 alpha，材质换成火焰色，并在外层套一层加色火壳；
 * 3. 尾巴上再加一小片贴地火光与上升余烬。
 *
 * 所有效果都挂在牧场动物的 outer 组里，跟着骨骼动画、走动、骑乘一起移动。
 */

const flameTime = { value: 0 };
let crackTexture: THREE.CanvasTexture | null = null;
let emberTexture: THREE.CanvasTexture | null = null;
let glowTexture: THREE.CanvasTexture | null = null;

function makeCrackTexture() {
  if (crackTexture) return crackTexture;
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  let seed = 20261126;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const stroke = (x: number, y: number, angle: number, count: number, width: number, color: string,
                  glow: string, blur: number, alpha: number) => {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = color;
    g.lineWidth = width;
    g.globalAlpha = alpha;
    g.shadowColor = glow;
    g.shadowBlur = blur;
    g.beginPath();
    g.moveTo(x, y);
    let px = x, py = y, a = angle;
    for (let i = 0; i < count; i++) {
      a += (rnd() - .5) * 1.12;
      px += Math.cos(a) * (5 + rnd() * 12);
      py += Math.sin(a) * (5 + rnd() * 12);
      g.lineTo(px, py);
    }
    g.stroke();
    g.restore();
    return [px, py, a] as const;
  };
  for (let i = 0; i < 30; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI * 2;
    const n = 10 + Math.floor(rnd() * 22), w = 2.2 + rnd() * 3.2;
    stroke(x, y, a, n, w, "#ff5a10", "#ff2200", 24, .38);
    stroke(x, y, a, n, w * .42, "#ff9a32", "#ff5600", 10, .58);
    const bx = x + Math.cos(a) * (10 + rnd() * 42);
    const by = y + Math.sin(a) * (10 + rnd() * 42);
    stroke(bx, by, a + (rnd() < .5 ? -1 : 1) * (.7 + rnd() * 1.1), 6 + Math.floor(rnd() * 12),
      w * .5, "#ff6818", "#ff2a00", 12, .4);
  }
  for (let i = 0; i < 9; i++) {
    stroke(rnd() * size, rnd() * size, rnd() * Math.PI * 2, 4 + Math.floor(rnd() * 7),
      1.2, "#6a5bff", "#3a20ff", 9, .26);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  crackTexture = tex;
  return tex;
}

function makeEmberTexture() {
  if (emberTexture) return emberTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,230,1)");
  grad.addColorStop(.18, "rgba(255,205,115,.95)");
  grad.addColorStop(.52, "rgba(255,92,22,.42)");
  grad.addColorStop(1, "rgba(255,40,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  emberTexture = tex;
  return tex;
}

function makeGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,116,34,.42)");
  grad.addColorStop(.48, "rgba(255,58,10,.16)");
  grad.addColorStop(1, "rgba(255,30,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTexture = tex;
  return tex;
}

/** 把马体网格里那截细尾三角形删掉，尾毛只由 Horse_Tail 承担。 */
function stripBakedTail(mesh: THREE.SkinnedMesh) {
  const sk = mesh.skeleton;
  const source = mesh.geometry;
  if (!sk || !source.index || !source.attributes.skinIndex || !source.attributes.skinWeight) return;
  const tailBones = new Set<number>();
  sk.bones.forEach((bone, i) => { if (/tail/i.test(bone.name || "")) tailBones.add(i); });
  if (!tailBones.size) return;
  const si = source.attributes.skinIndex, sw = source.attributes.skinWeight;
  const src = source.index.array;
  const out: number[] = [];
  for (let t = 0; t < src.length; t += 3) {
    let tailVerts = 0;
    for (let k = 0; k < 3; k++) {
      let w = 0;
      for (let j = 0; j < 4; j++) {
        if (tailBones.has(si.getComponent(src[t + k], j))) w += sw.getComponent(src[t + k], j);
      }
      if (w > .45) tailVerts++;
    }
    if (tailVerts < 3) out.push(src[t], src[t + 1], src[t + 2]);
  }
  if (out.length === src.length) return;
  const geo = source.clone();
  geo.setIndex(out);
  geo.computeBoundingSphere();
  mesh.geometry = geo;
}

function bodyMaterial(source: THREE.Material) {
  const mat = source.clone();
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
  mat.map = null;
  mat.color.set(0x0b0709);
  mat.roughness = .60;
  mat.metalness = .10;
  mat.emissive.set(0xffffff);
  mat.emissiveMap = makeCrackTexture();
  mat.emissiveIntensity = 1.45;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFlameTime = flameTime;
    shader.vertexShader = "varying vec3 vFlameP;\n" + shader.vertexShader
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFlameP=position;");
    shader.fragmentShader = `uniform float uFlameTime; varying vec3 vFlameP;\n${shader.fragmentShader}`
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float breathe=.84+.16*sin(uFlameTime*2.0+vFlameP.y*9.0+vFlameP.z*5.0);
        totalEmissiveRadiance*=breathe;
        float rim=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),3.6);
        totalEmissiveRadiance+=vec3(1.0,.16,.01)*rim*.20;`);
  };
  mat.customProgramCacheKey = () => "flame-horse-body";
  return mat;
}

function hairMaterial(source: THREE.Material, heatLow: number, heatHigh: number) {
  const mat = source.clone();
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
  mat.color.set(0x000000);
  mat.roughness = .92;
  mat.metalness = 0;
  mat.emissive.set(0xff5c12);
  mat.emissiveMap = null;
  mat.emissiveIntensity = 1.45;
  mat.alphaTest = Math.max(mat.alphaTest || 0, .16);
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFlameTime = flameTime;
    shader.uniforms.uHeatLow = { value: heatLow };
    shader.uniforms.uHeatHigh = { value: heatHigh };
    shader.vertexShader = `uniform float uHeatLow; uniform float uHeatHigh; varying float vHeat;\n` + shader.vertexShader
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vHeat=1.0-smoothstep(uHeatLow,uHeatHigh,position.y);`);
    shader.fragmentShader = `uniform float uFlameTime; varying float vHeat;\n${shader.fragmentShader}`
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float flicker=.82+.18*sin(uFlameTime*3.4+vHeat*9.0);
        totalEmissiveRadiance*=(.10+1.15*vHeat)*flicker;`);
  };
  mat.customProgramCacheKey = () => "flame-horse-hair";
  return mat;
}

/** 套在真实网格外层的一层加色火壳；alpha 取自原毛发的 alpha，不会变成一块实心片。 */
function flameShell(mesh: THREE.SkinnedMesh, opacity: number, amplitude: number, map: THREE.Texture | null, key: string,
                    heatLow = 0, heatHigh = 1, useHeat = false) {
  const mat = new THREE.MeshBasicMaterial({
    map,
    color: 0xff6a18,
    transparent: true,
    opacity: 1,
    alphaTest: map ? .06 : 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFlameTime = flameTime;
    shader.uniforms.uShellAmp = { value: amplitude };
    shader.uniforms.uShellOpacity = { value: opacity };
    shader.uniforms.uHeatLow = { value: heatLow };
    shader.uniforms.uHeatHigh = { value: heatHigh };
    shader.uniforms.uUseHeat = { value: useHeat ? 1 : 0 };
    shader.vertexShader = `uniform float uFlameTime; uniform float uShellAmp;
      uniform float uHeatLow; uniform float uHeatHigh; uniform float uUseHeat;
      varying vec3 vShellP; varying float vShellF; varying float vShellHeat;\n` + shader.vertexShader
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vShellP=position;
        vShellHeat=mix(1.0,1.0-smoothstep(uHeatLow,uHeatHigh,position.y),uUseHeat);
        float wob=.45+.55*sin(uFlameTime*2.1+position.y*4.0+position.z*3.0);
        transformed+=normal*uShellAmp*wob;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        vShellF=pow(1.0-abs(dot(normalize(normalMatrix*normal),normalize(-mvPosition.xyz))),2.4);`);
    shader.fragmentShader = `uniform float uFlameTime; uniform float uShellOpacity;
      varying vec3 vShellP; varying float vShellF; varying float vShellHeat;
      float fh(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float fn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        return mix(mix(mix(fh(i),fh(i+vec3(1,0,0)),f.x),mix(fh(i+vec3(0,1,0)),fh(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(fh(i+vec3(0,0,1)),fh(i+vec3(1,0,1)),f.x),mix(fh(i+vec3(0,1,1)),fh(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*fn(p);p*=2.03;a*=.5;}return v;}\n`
      + shader.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        float n=fbm(vShellP*6.4+vec3(0.,uFlameTime*.28,0.));
        float n2=fbm(vShellP*13.-vec3(uFlameTime*.4,0.,uFlameTime*.2));
        float burn=fbm(vec3(vShellP.x*9.+1.0,vShellP.y*8.-uFlameTime*1.4,vShellP.z*4.));
        float a=(.30+.70*n)*(.55+.45*n2)*uShellOpacity*(.36+.64*vShellHeat);
        a*=smoothstep(.22,.58,burn);
        if(vShellF>.01) a*=.72+.28*vShellF;
        vec3 c=mix(vec3(.92,.06,0.),vec3(1.,.70,.18),clamp(n*.65+vShellHeat*.55,0.,1.));
        diffuseColor.rgb=c;
        diffuseColor.a*=a;`);
  };
  mat.customProgramCacheKey = () => "flame-horse-shell-" + key;
  const shell = new THREE.SkinnedMesh(mesh.geometry, mat);
  shell.bind(mesh.skeleton, mesh.bindMatrix);
  shell.bindMode = mesh.bindMode;
  shell.position.copy(mesh.position);
  shell.quaternion.copy(mesh.quaternion);
  shell.scale.copy(mesh.scale);
  shell.frustumCulled = false;
  shell.renderOrder = 4;
  mesh.parent?.add(shell);
  return { shell, mat };
}

interface Ember { x: number; y: number; z: number; speed: number; drift: number; phase: number }
interface FlameAnchor { mesh: THREE.SkinnedMesh; index: number; down: boolean }

/** 7 层交叉切片组成的体积火：锚在真实鬃尾顶点上，火焰沿毛发生长方向烧。 */
function makeVolumeFire(hair: THREE.SkinnedMesh[], outer: THREE.Group) {
  const anchors: FlameAnchor[] = [];
  for (const mesh of hair) {
    const count = mesh.geometry.attributes.position.count;
    const down = /tail/i.test(mesh.name);
    const picks = down ? 18 : 12;
    const start = down ? .22 : .12, span = down ? .72 : .82;
    for (let i = 0; i < picks; i++) {
      const t = start + span * (i + .5) / picks;
      anchors.push({ mesh, index: Math.min(count - 1, Math.floor(t * count)), down });
    }
  }
  const slices = 7;
  const quads = anchors.length * slices;
  const corners = new Float32Array(quads * 4 * 2);
  const uvs = new Float32Array(quads * 4 * 2);
  const slicesAttr = new Float32Array(quads * 4);
  const scales = new Float32Array(quads * 4 * 2);
  const downs = new Float32Array(quads * 4);
  const centers = new Float32Array(quads * 4 * 3);
  const offsets = new Float32Array(quads * 3);
  const indices: number[] = [];
  const quadCorner = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
  const quadUv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let q = 0; q < quads; q++) {
    const anchor = anchors[Math.floor(q / slices)];
    const slice = q % slices;
    const sizeX = (anchor.down ? .46 : .50) * (.84 + Math.random() * .34);
    const sizeY = (anchor.down ? .64 : .84) * (.84 + Math.random() * .34);
    offsets[q * 3] = (Math.random() * 2 - 1) * .13;
    offsets[q * 3 + 1] = (anchor.down ? -.03 : .035) + (Math.random() * 2 - 1) * .045;
    offsets[q * 3 + 2] = (Math.random() * 2 - 1) * .11;
    for (let k = 0; k < 4; k++) {
      const v = q * 4 + k;
      corners[v * 2] = quadCorner[k][0];
      corners[v * 2 + 1] = quadCorner[k][1];
      uvs[v * 2] = quadUv[k][0];
      uvs[v * 2 + 1] = quadUv[k][1];
      slicesAttr[v] = slice;
      scales[v * 2] = sizeX;
      scales[v * 2 + 1] = sizeY;
      downs[v] = anchor.down ? 1 : 0;
    }
    const a = q * 4;
    indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aSlice", new THREE.BufferAttribute(slicesAttr, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 2));
  geometry.setAttribute("aDown", new THREE.BufferAttribute(downs, 1));
  const centerAttr = new THREE.BufferAttribute(centers, 3);
  geometry.setAttribute("aCenter", centerAttr);
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: flameTime,
      uWind: { value: new THREE.Vector3() },
      uOpacity: { value: .09 },
    },
    vertexShader: `
      attribute vec3 aCenter; attribute vec2 aCorner; attribute vec2 aUv;
      attribute float aSlice; attribute vec2 aScale; attribute float aDown;
      uniform float uTime; uniform vec3 uWind;
      varying vec2 vUv; varying float vSlice;
      void main(){
        vUv=aUv; vSlice=aSlice;
        float flicker=.88+.12*sin(uTime*2.2+aSlice*.9);
        vec2 q=aCorner*aScale*flicker;
        if(aDown>.5) q.y=-q.y;
        vec4 mv=modelViewMatrix*vec4(aCenter,1.0);
        // 速度风：按切片根部到梢部的距离做三维剪切，整簇火朝运动反方向倒。
        vec3 windView=mat3(viewMatrix)*uWind;
        float h=(aDown>.5?-q.y:q.y)*flicker;
        mv.xy+=q;
        mv.xyz+=windView*h*1.85;
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader: `
      uniform float uTime; uniform float uOpacity;
      varying vec2 vUv; varying float vSlice;
      float hash3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float noise3(vec3 p){
        vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        float n000=hash3(i), n100=hash3(i+vec3(1,0,0));
        float n010=hash3(i+vec3(0,1,0)), n110=hash3(i+vec3(1,1,0));
        float n001=hash3(i+vec3(0,0,1)), n101=hash3(i+vec3(1,0,1));
        float n011=hash3(i+vec3(0,1,1)), n111=hash3(i+vec3(1,1,1));
        return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
                   mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
      }
      float fbm3(vec3 p){ float v=0., a=.5; for(int i=0;i<3;i++){ v+=a*noise3(p); p*=2.07; a*=.5; } return v; }
      void main(){
        float y=clamp(vUv.y,0.,1.);
        float x=(vUv.x-.5)*2.;
        float s=vSlice;
        float warp=fbm3(vec3(x*1.4+1.0,y*1.6-uTime*.75,s*1.1));
        x+=(warp-.5)*.30*pow(y,.8);
        x+=.07*sin(y*13.-uTime*5.5+s*3.1)*y;
        float w=.46*(1.-.55*y)+.08;
        float env=exp(-pow(abs(x)/w,2.));
        vec3 q=vec3(x*3.2,y*3.-uTime*3.,s*1.6+uTime*.5);
        float n=fbm3(q);
        float n2=fbm3(q*2.3+vec3(2.7,-uTime*1.5,0.));
        float shape=n*.55+n2*.45;
        float base=smoothstep(0.,.08,y);
        float tip=exp(-pow(max(0.,(y-(.30+shape*.45))/.34),2.));
        tip*=1.-smoothstep(.78,1.,y);
        float erode=fbm3(vec3(x*5.,y*6.-uTime*3.,s*2.));
        float bite=fbm3(vec3(x*7.,y*10.-uTime*4.5,s*3.));
        float lick=fbm3(vec3(x*9.,y*13.-uTime*6.,s*2.7));
        float a=env*base*tip*smoothstep(.28,.62,shape)*smoothstep(.16,.46,erode)
          *smoothstep(.22,.50,bite)*mix(.70,1.,smoothstep(.34,.58,lick))*.95;
        float hot=pow(1.-y,2.)*(.4+.6*shape)*smoothstep(.22,.80,shape);
        vec3 c=mix(vec3(1.,.40,.055),vec3(.92,.08,.01),smoothstep(.15,.95,y));
        c+=vec3(1.,.74,.30)*hot*.28;
        gl_FragColor=vec4(c,a*uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return { anchors, slices, quads, material, geometry, centerAttr, offsets, mesh: new THREE.Mesh(geometry, material), outer };
}

export function createFlameHorseLook(outer: THREE.Group, model: THREE.Group, meshes: THREE.SkinnedMesh[]) {
  const body = meshes.find(mesh => /Celt/i.test(mesh.name)) ?? meshes[0];
  const hair = meshes.filter(mesh => /mane|tail/i.test(mesh.name) && mesh !== body);
  const ownedMaterials: THREE.Material[] = [];
  const shells: THREE.Mesh[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];

  if (body) stripBakedTail(body);
  if (body?.geometry) ownedGeometries.push(body.geometry);

  let bodyLook: THREE.Material | null = null;
  const sourceMaterial = (mesh: THREE.SkinnedMesh) => Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (body) {
    bodyLook = bodyMaterial(sourceMaterial(body));
    body.material = bodyLook;
    ownedMaterials.push(bodyLook);
    const shell = flameShell(body, .15, .012, null, "body");
    shells.push(shell.shell);
    ownedMaterials.push(shell.mat);
  }
  for (const mesh of hair) {
    const src = sourceMaterial(mesh);
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    const low = bounds ? bounds.min.y : 0;
    const high = bounds ? bounds.max.y : 1;
    const range = Math.max(.001, high - low);
    const heatLow = low + range * .12;
    const heatHigh = low + range * .88;
    const mat = hairMaterial(src, heatLow, heatHigh);
    mesh.material = mat;
    ownedMaterials.push(mat);
    const map = src instanceof THREE.MeshStandardMaterial ? src.map : null;
    const shell = flameShell(mesh, .62, .017, map, "hair-" + mesh.name, heatLow, heatHigh, true);
    shells.push(shell.shell);
    ownedMaterials.push(shell.mat);
  }

  // 马头相对脊椎的水平方向就是模型前向；体积火在奔跑时朝它的反方向倒。
  const forward = new THREE.Vector3(0, 0, 1);
  const headBone = model.getObjectByName("Horse_Head");
  const spineBone = model.getObjectByName("Horse_Spine_2");
  if (headBone && spineBone) {
    outer.updateWorldMatrix(true, true);
    const headPos = headBone.getWorldPosition(new THREE.Vector3());
    const spinePos = spineBone.getWorldPosition(new THREE.Vector3());
    outer.worldToLocal(headPos);
    outer.worldToLocal(spinePos);
    forward.set(headPos.x - spinePos.x, 0, headPos.z - spinePos.z);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    else forward.normalize();
  }

  const volume = hair.length ? makeVolumeFire(hair, outer) : null;
  if (volume) {
    volume.mesh.frustumCulled = false;
    volume.mesh.renderOrder = 7;
    volume.mesh.name = "flame-horse-volume";
    outer.add(volume.mesh);
    ownedGeometries.push(volume.geometry);
    ownedMaterials.push(volume.material);
  }

  // 解析 outer 本地包围盒，余烬沿背脊与臀部上浮。
  outer.updateWorldMatrix(true, true);
  const worldBox = new THREE.Box3().setFromObject(model);
  const min = outer.worldToLocal(worldBox.min.clone());
  const max = outer.worldToLocal(worldBox.max.clone());
  const spanX = Math.max(.32, Math.min(.62, (max.x - min.x) * .5));
  const spanZ = Math.max(.5, Math.min(1.05, (max.z - min.z) * .5));
  const bottom = Math.min(max.y - .18, min.y + (max.y - min.y) * .52);
  const top = max.y - .03;

  const emberCount = 72;
  const embers: Ember[] = [];
  const positions = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    embers.push({
      x: (Math.random() * 2 - 1) * spanX,
      y: bottom + Math.random() * Math.max(.2, top - bottom),
      z: (Math.random() * 2 - 1) * spanZ,
      speed: .15 + Math.random() * .32,
      drift: .04 + Math.random() * .12,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const emberMat = new THREE.PointsMaterial({
    map: makeEmberTexture(),
    color: 0xffa24a,
    size: .055,
    sizeAttenuation: true,
    transparent: true,
    opacity: .9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const emberPoints = new THREE.Points(emberGeo, emberMat);
  emberPoints.frustumCulled = false;
  emberPoints.renderOrder = 6;
  outer.add(emberPoints);
  ownedGeometries.push(emberGeo);
  ownedMaterials.push(emberMat);

  const glowGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const glowMat = new THREE.MeshBasicMaterial({
    map: makeGlowTexture(),
    transparent: true,
    opacity: .5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = .012;
  glow.renderOrder = 2;
  outer.add(glow);
  ownedGeometries.push(glowGeo);
  ownedMaterials.push(glowMat);

  // 一小盏暖光跟着神驹，让黑曜石马体在白天也读得出轮廓，也让蹄下草皮有一点火光。
  const aura = new THREE.PointLight(0xff4a12, 2.6, 5.5, 2);
  aura.position.set(0, 1.15, -.25);
  outer.add(aura);

  let lastTime = NaN;
  const sample = new THREE.Vector3();
  const centerArr = volume ? volume.centerAttr.array as Float32Array : null;
  const worldQuat = new THREE.Quaternion();
  const worldWind = new THREE.Vector3();
  function update(time: number, dt: number, stride = 0, wind?: THREE.Vector3) {
    flameTime.value = time;
    if (volume && centerArr) {
      const strength = THREE.MathUtils.clamp((stride - .04) / .9, 0, 1);
      // 只认“马尾方向”，不再用位移方向：位移可能和模型朝向相反，
      // 一旦反向就会把鬃火吹到马头前面。头→脊椎的反向就是尾巴，永远朝后。
      void wind;
      outer.getWorldQuaternion(worldQuat);
      worldWind.copy(forward).applyQuaternion(worldQuat).multiplyScalar(-strength);
      volume.material.uniforms.uWind.value.copy(worldWind);
      outer.updateWorldMatrix(true, true);
      for (const mesh of hair) mesh.skeleton?.update();
      for (let a = 0; a < volume.anchors.length; a++) {
        const anchor = volume.anchors[a];
        anchor.mesh.getVertexPosition(anchor.index, sample);
        anchor.mesh.localToWorld(sample);
        outer.worldToLocal(sample);
        for (let s = 0; s < volume.slices; s++) {
          const q = a * volume.slices + s;
          const ox = volume.offsets[q * 3], oy = volume.offsets[q * 3 + 1], oz = volume.offsets[q * 3 + 2];
          for (let k = 0; k < 4; k++) {
            const v = q * 4 + k;
            centerArr[v * 3] = sample.x + ox;
            centerArr[v * 3 + 1] = sample.y + oy;
            centerArr[v * 3 + 2] = sample.z + oz;
          }
        }
      }
      volume.centerAttr.needsUpdate = true;
    }
    if (!Number.isFinite(dt) || dt <= 0 || dt > .4) return;
    if (time - lastTime > 2.2) {
      // 远距离时 animate 会被节流，回来时不要把整段余烬一次性跳完。
      lastTime = time;
    }
    lastTime = time;
    const arr = emberGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < emberCount; i++) {
      const e = embers[i];
      e.y += e.speed * dt;
      if (e.y > top + .18) {
        e.y = bottom;
        e.x = (Math.random() * 2 - 1) * spanX;
        e.z = (Math.random() * 2 - 1) * spanZ;
      }
      arr[i * 3] = e.x + Math.sin(time * 1.7 + e.phase) * e.drift;
      arr[i * 3 + 1] = e.y;
      arr[i * 3 + 2] = e.z + Math.cos(time * 1.3 + e.phase) * e.drift;
    }
    emberGeo.attributes.position.needsUpdate = true;
    glowMat.opacity = .38 + .12 * Math.sin(time * 2.4);
  }

  function dispose() {
    for (const shell of shells) shell.removeFromParent();
    volume?.mesh.removeFromParent();
    emberPoints.removeFromParent();
    glow.removeFromParent();
    aura.removeFromParent();
    for (const geo of ownedGeometries) geo.dispose();
    for (const mat of ownedMaterials) mat.dispose();
  }

  return { update, dispose };
}
