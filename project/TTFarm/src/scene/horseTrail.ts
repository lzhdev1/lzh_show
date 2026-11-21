import * as THREE from "three";

const LIFETIME = .48;
const SPACING = .33;
const CAPACITY = 36;
const STRANDS = 4;
const INDICES_PER_SECTION = (STRANDS + 1) * 6;

function makeRibbons() {
  // One indexed draw includes the woven ribbons and their scattered star glints.
  const nodes: number[] = [], corners: number[] = [], indices: number[] = [];
  for (let s = 0; s < CAPACITY; s++) {
    for (let lane = 0; lane <= STRANDS; lane++) {
      const first = nodes.length / 3;
      for (let corner = 0; corner < 4; corner++) {
        const far = corner >= 2;
        nodes.push(s + Number(lane < STRANDS && far), lane, 0);
        corners.push(corner % 2 ? 1 : -1, far ? 1 : -1);
      }
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(nodes, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(corners, 2));
  geometry.setDrawRange(0, 0);

  // The last slot is the live tail tip. Older slots stay fixed in world space.
  const points = new Float32Array((CAPACITY + 1) * 4);
  const frames = new Float32Array((CAPACITY + 1) * 3);
  const uniforms = {
    points: { value: points }, frames: { value: frames },
    newest: { value: 0 }, sections: { value: 0 }, clock: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide, forceSinglePass: true,
    vertexShader: `
      uniform vec4 points[${CAPACITY + 1}];
      uniform vec3 frames[${CAPACITY + 1}];
      uniform int newest, sections;
      uniform float clock;
      varying float strand, life, metre;
      varying vec2 ink;

      int slotAt(int node) {
        if (node == 0) return ${CAPACITY};
        return (newest - node + 1 + ${CAPACITY}) % ${CAPACITY};
      }
      vec3 ribbon(int i, float lane) {
        vec3 frame = frames[i];
        float age = clamp((clock-points[i].w)/${LIFETIME}, 0., 1.);
        float phase = frame.z * .79 + lane * 1.59;
        float open = .12+.88*smoothstep(0.,.95,frames[${CAPACITY}].z-frame.z);
        float spread = open*((.10 + age*.15) * sin(phase) + (lane-1.5)*.085);
        float rise = open*(.12*cos(phase) + .07*sin(phase*.61)) + age*.30;
        return points[i].xyz + vec3(frame.x*spread, rise, frame.y*spread);
      }
      void main() {
        int node = int(position.x + .5), i = slotAt(node);
        strand = position.y; ink = uv; metre = frames[i].z;
        life = clamp((clock-points[i].w)/${LIFETIME}, 0., 1.);
        if (strand < ${STRANDS}.) {
          vec4 p = modelViewMatrix * vec4(ribbon(i,strand), 1.);
          vec3 before = ribbon(slotAt(max(0,node-1)),strand);
          vec3 after = ribbon(slotAt(min(sections,node+1)),strand);
          vec3 dir = mat3(modelViewMatrix)*(after-before);
          vec2 tangent = -p.z*dir.xy + p.xy*dir.z;
          vec2 normal = length(tangent)>.00001 ? normalize(vec2(-tangent.y,tangent.x)) : vec2(1.,0.);
          float width = strand < .5 ? .126 : strand < 2.5 ? .073 : .040;
          float fan = .12+.88*smoothstep(0.,.70,frames[${CAPACITY}].z-metre);
          p.xy += normal * uv.x * width * fan * (1.-.74*life);
          gl_Position = projectionMatrix * p;
        } else {
          float seed = fract(metre*1.371+.41);
          vec4 p = modelViewMatrix * vec4(ribbon(i, floor(seed*3.)), 1.);
          p.xy += vec2(sin(metre*6.71)*.38, .15+cos(metre*2.73)*.20) * (.38+life);
          float size = node==0 || seed>.36 ? 0. : (.038+.047*seed/.36)*(1.-life);
          p.xy += uv*vec2(size,1.24*size);
          gl_Position = projectionMatrix*p;
        }
      }
    `,
    fragmentShader: `
      uniform float clock;
      varying float strand, life, metre;
      varying vec2 ink;
      void main() {
        float hue = .57 + strand*.193 + metre*.068 - clock*.23 + ink.x*.042;
        vec3 prism = pow(.55+.45*cos(6.28318*(hue+vec3(0.,.667,.333))),vec3(1.6));
        float alpha, pearl;
        if (strand < ${STRANDS}.) {
          float across = abs(ink.x);
          float edge = exp(-17.*abs(across-.60));
          float spine = exp(-10.*abs(ink.x+.095*sin(metre*4.2-clock*6.)));
          float sheen = pow(.5+.5*cos(metre*5.-clock*8.+strand),8.);
          alpha = (1.-smoothstep(.25,1.,across))*.75 + edge*.30 + spine*.24;
          pearl = .52*spine + .57*edge + .20*sheen;
        } else {
          float radius = length(ink);
          float rays = pow(abs(ink.x),.51) + pow(abs(ink.y),.51);
          alpha = 1.-smoothstep(.74,1.07,rays) + .19*exp(-3.5*radius);
          pearl = .63+.37*exp(-6.*radius);
        }
        alpha *= (1.-smoothstep(.15,1.,life));
        if (alpha<.012) discard;
        gl_FragColor = vec4(mix(prism,vec3(1.),min(.97,pearl)),min(.96,alpha));
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "horse-rainbow-ribbons";
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, geometry, material, points, frames, uniforms };
}

/** Pass world-space horse positions, +Z forward. Attach mesh to a stationary scene group. */
export function createHorseTrail() {
  const mesh = new THREE.Group();
  mesh.name = "horse-speed-trail";
  mesh.visible = false;
  const lastRoot = new THREE.Vector3(), lastTip = new THREE.Vector3(), tip = new THREE.Vector3();
  let ribbons: ReturnType<typeof makeRibbons> | undefined;
  let emitting = false, newest = -1, count = 0, distance = 0, nextMark = 0;
  let lastTime = -Infinity, lastYaw = 0, tipTime = 0;

  function clear() {
    emitting = false; count = 0; newest = -1; distance = 0; nextMark = SPACING;
    mesh.visible = false;
    ribbons?.geometry.setDrawRange(0, 0);
  }
  function write(slot: number, x: number, y: number, z: number, yaw: number, at: number, travel: number) {
    const p = ribbons!.points, f = ribbons!.frames;
    p[4*slot] = x; p[4*slot+1] = y; p[4*slot+2] = z; p[4*slot+3] = at;
    f[3*slot] = Math.cos(yaw); f[3*slot+1] = -Math.sin(yaw); f[3*slot+2] = travel;
  }
  function record(x: number, y: number, z: number, yaw: number, at: number, travel: number) {
    newest = (newest + 1) % CAPACITY;
    count = Math.min(CAPACITY, count + 1);
    write(newest, x, y, z, yaw, at, travel);
  }
  return {
    mesh, clear,
    update(time: number, root: THREE.Vector3, yaw: number, running: boolean) {
      if (!running && !emitting && !mesh.visible) return;
      const dt = time-lastTime, travel = root.distanceTo(lastRoot);
      // A room change, dropped tab, or snapped network pose must not draw across the farm.
      if (dt < 0 || dt > .5 || travel > Math.max(2.8, dt*35+1)) clear();
      if (running) {
        if (!ribbons) { ribbons = makeRibbons(); mesh.add(ribbons.mesh); }
        tip.set(root.x-.98*Math.sin(yaw), root.y+.76, root.z-.98*Math.cos(yaw));
        if (!emitting) {
          clear();
          record(tip.x,tip.y,tip.z,yaw,time,0);
          tipTime = time;
        } else if (travel > .0001) {
          const end = distance+travel;
          const turn = Math.atan2(Math.sin(yaw-lastYaw), Math.cos(yaw-lastYaw));
          while (nextMark <= end) {
            const f = (nextMark-distance)/travel;
            record(THREE.MathUtils.lerp(lastTip.x,tip.x,f), THREE.MathUtils.lerp(lastTip.y,tip.y,f),
              THREE.MathUtils.lerp(lastTip.z,tip.z,f), lastYaw+turn*f, lastTime+dt*f, nextMark);
            nextMark += SPACING;
          }
          distance = end;
          tipTime = time;
        }
        write(CAPACITY,tip.x,tip.y,tip.z,yaw,tipTime,distance);
        lastTip.copy(tip);
        lastYaw = yaw;
      }
      emitting = running;
      lastTime = time;
      lastRoot.copy(root);
      if (!ribbons || count===0) return;
      while (count && time-ribbons.points[((newest-count+1+CAPACITY)%CAPACITY)*4+3] > LIFETIME) count--;
      const duplicateTip = Math.abs(distance-ribbons.frames[newest*3+2]) < .002;
      const segments = Math.max(0, count-Number(duplicateTip));
      ribbons.uniforms.newest.value = (newest-Number(duplicateTip)+CAPACITY)%CAPACITY;
      ribbons.uniforms.sections.value = segments;
      ribbons.uniforms.clock.value = time;
      ribbons.geometry.setDrawRange(0, segments*INDICES_PER_SECTION);
      mesh.visible = segments>0 && time-tipTime<LIFETIME;
    },
    dispose() {
      clear();
      mesh.removeFromParent();
      ribbons?.geometry.dispose(); ribbons?.material.dispose(); mesh.clear();
    },
  };
}
