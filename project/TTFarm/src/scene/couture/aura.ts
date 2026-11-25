import * as T from "three";
import type { CoutureFamily, CoutureId } from "../../game/couture";
import type { V } from "./atelier";

// kind 0 is a sequin sewn onto the cloth, 1 a passing petal/bubble/star,
// 2 a diffuse patch of light, 3 a short ribbon with tapered ends,
// 4 a hovering glow-butterfly sprite, 5 a rose spark in its wake, 6 a gold spark,
// 7 a rose filament and 8 a gold filament, both drawn as screen-space ribbons.
export type Orbit = [speed: number, angle: number, rise: number, kind: number];
type AddVertex = (center:V, size:number, tint:number, uv:[number,number], orbit:Orbit)=>number;

const tau = Math.PI * 2;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const finishes = {
  petal: { rim:0xffb8ce, glint:0xffecd4, speed:.42, rise:.12 },
  tide:  { rim:0x8cdeed, glint:0xe0fffa, speed:.34, rise:.09 },
  astral:{ rim:0xb0b3ff, glint:0xffe5c1, speed:.50, rise:.14 },
};

/** Emit strips and camera-facing quads into the garment's existing sparkle batch.
 * Only the vertices of a worn outfit exist. Every position is animated on the GPU. */
export function weaveAura(id:CoutureId, family:CoutureFamily, dye:string, width:number, hem:number,
    add:AddVertex, indices:number[]) {
  const palette=finishes[family];
  const main=new T.Color(dye).lerp(new T.Color(palette.rim),.55).getHex();
  let seed=0;
  for(const c of id) seed=(seed*31+c.charCodeAt(0))>>>0;
  const phase=(seed%1024)*tau/1024;
  const quiet = id === "butterfly-veil";
  const ambientGlint=quiet?0xffd4e1:palette.glint;
  const floor=T.MathUtils.clamp(hem,.25,.71);
  const outer=T.MathUtils.clamp(width+.074,.305,.523);
  const radiusAt=(y:number)=>T.MathUtils.lerp(outer,.228,T.MathUtils.smoothstep(y,floor+.05,1.21));
  function mote(y:number, radius:number, size:number, color:number, orbit:Orbit) {
    const center:V=[radius,y,0];
    const first=add(center,size,color,[0,0],orbit);
    add(center,size,color,[1,0],orbit);add(center,size,color,[1,1],orbit);add(center,size,color,[0,1],orbit);
    indices.push(first,first+1,first+2,first,first+2,first+3);
  }
  for(let i=0;i<13;i++){
    if(quiet) break;
    const t=((i*7+2)%13)/13, y=T.MathUtils.lerp(floor+.06,1.20,t);
    const angle=phase+i*goldenAngle;
    const speed=palette.speed*(.75+.12*(i%4));
    const size=i%4===0?.055:i%3===0?.039:.027;
    mote(y,radiusAt(y)+(.015*(i%3)),size,i%3===0?ambientGlint:main,[speed,angle,palette.rise*.55,1]);
  }
  // Broader, very low-opacity glows slip across the outside of the silhouette.
  for(let i=0;i<5;i++){
    if(quiet) break;
    const y=T.MathUtils.lerp(floor+.05,1.17,i/5);
    const glow=quiet?.032+i%2*.006:.135+i%2*.022;
    mote(y,radiusAt(y)-.032,glow,main,[palette.speed*.82,phase+i*goldenAngle,.052,2]);
  }
  for(let strand=0;strand<2;strand++){
    if(quiet) break;
    const y=strand===0?floor+.10:.91;
    const center:V=[radiusAt(y),y,0];
    const orbit:Orbit=[palette.speed*(strand===0?1:.77),phase+strand*2.76,palette.rise*(strand===0?.67:1.12),3];
    const sections=27;
    for(let j=0;j<=sections;j++){
      const t=j/sections;
      const lower=add(center,.020,main,[t,0],orbit);
      add(center,.020,palette.glint,[t,1],orbit);
      if(j>0)indices.push(lower-2,lower,lower-1,lower-1,lower,lower+1);
    }
  }
  if (id === "butterfly-veil") {
    // A few large lantern-butterflies with twin glitter wakes, plus a drift of tiny ones.
    const wing=0xff9fc8, sparkle=0xfff1f7, gold=0xffd7a3;
    for(let i=0;i<4;i++){
      const y=T.MathUtils.lerp(floor+.12,.92,(i+.5)/4);
      const radius=radiusAt(y)+.118;
      const orbit:Orbit=[.46+.04*(i%2),phase+i*1.57+1.20,.05+(i%2)*.02,4];
      mote(y,radius,.064+(i%2)*.010,i%2?sparkle:wing,orbit);
      for(let s=0;s<2;s++){
        const length=s?.45:.60;
        const sections=44;
        const center:V=[radius,y,0];
        const thread:Orbit=[orbit[0]*(s?.9:1.03),orbit[1]+.04*s,length,s?8:7];
        for(let j=0;j<=sections;j++){
          const t=j/sections;
          const lower=add(center,.020+(s?.001:.002),s?gold:sparkle,[t,0],thread);
          add(center,.020+(s?.001:.002),s?sparkle:wing,[t,1],thread);
          if(j>0)indices.push(lower-2,lower,lower-1,lower-1,lower,lower+1);
        }
      }
    }
    for(let i=0;i<12;i++){
      const y=T.MathUtils.lerp(floor+.05,1.10,((i*7)%12)/11);
      const radius=radiusAt(y)+.100+((i*3)%5)*.012;
      const orbit:Orbit=[.72+.08*(i%3),phase+i*goldenAngle+1.10,.02,4];
      mote(y,radius,.017+.004*(i%3),i%2?sparkle:wing,orbit);
      const thread:Orbit=[orbit[0]*.92,orbit[1]-.05,.20+(i%3)*.035,i%2?8:7];
      const center:V=[radius,y,0];
      for(let k=0;k<=18;k++){
        const t=k/18;
        const lower=add(center,.014,i%2?gold:wing,[t,0],thread);
        add(center,.014,i%2?wing:gold,[t,1],thread);
        if(k)indices.push(lower-2,lower,lower-1,lower-1,lower,lower+1);
      }
    }
    if(!quiet)
    for(let i=0;i<22;i++){
      const y=T.MathUtils.lerp(floor+.03,1.12,(i%11)/10);
      mote(y,radiusAt(y)+.030+((i*5)%7)*.020,.008+.003*(i%3),i%3?0xffc9df:gold,
        [.72,phase+i*goldenAngle,.018,0]);
    }
  }
}

let butterflyTexture: T.Texture | undefined;
let butterflyRim: T.Texture | undefined;
function butterflySprite() {
  if (!butterflyTexture) {
    butterflyTexture = new T.TextureLoader().load("/ttfarm/avatars/aura/butterfly.png?v=4");
    butterflyTexture.colorSpace = T.SRGBColorSpace;
    butterflyTexture.anisotropy = 4;
  }
  return butterflyTexture;
}
function butterflyEdge() {
  if (!butterflyRim) {
    butterflyRim = new T.TextureLoader().load("/ttfarm/avatars/aura/butterfly-rim.png?v=4");
    butterflyRim.colorSpace = T.SRGBColorSpace;
    butterflyRim.anisotropy = 4;
  }
  return butterflyRim;
}

export function auraMaterial(family:CoutureFamily,time:T.IUniform<number>) {
  const m=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,
    side:T.DoubleSide,toneMapped:false,premultipliedAlpha:true});
  m.forceSinglePass=true;
  m.customProgramCacheKey=()=>"couture-aura-"+family;
  const bufferSize=new T.Vector2();
  const resolution={value:1};
  const butterflyMap={value:butterflySprite()};
  const butterflyRimMap={value:butterflyEdge()};
  m.onBeforeRender=renderer=>{resolution.value=renderer.getDrawingBufferSize(bufferSize).y;};
  m.onBeforeCompile = s=>{
    s.uniforms.uCoutureTime=time;
    s.uniforms.uPixelHeight=resolution;
    s.uniforms.uButterflyMap=butterflyMap;
    s.uniforms.uButterflyRim=butterflyRimMap;
    const varying="varying vec2 vShape; varying vec2 vAuraUv; varying float vKind; varying float vBeat; varying float vSpin; uniform float uCoutureTime; uniform sampler2D uButterflyMap; uniform sampler2D uButterflyRim;\n";
    s.vertexShader=varying+"attribute vec4 orbit; attribute float radius; uniform float uPixelHeight;\n"+s.vertexShader;
    s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vShape = uv * 2. - 1.;
      vAuraUv = uv;
      vKind = orbit.w;
      bool butterfly = vKind > 3.5 && vKind < 4.5;
      bool ribbon = vKind > 2.5 && vKind < 3.5;
      bool tail = vKind > 4.5;
      bool thread = vKind > 6.5;
      bool billboard = vKind < 2.5 || vKind > 3.5;
      float angle = orbit.y + orbit.x*uCoutureTime;
      vSpin = .36*sin(angle*1.3) + orbit.y;
      vBeat = .5+.5*sin(uCoutureTime*1.8 + (vKind<.5 ? dot(position,vec3(21.,49.,37.)) : orbit.y*2.));
      // Keep the fine moving filaments readable when the farm camera pulls out.
      float clipW=abs((projectionMatrix*modelViewMatrix*vec4(position,1.)).w);
      float unitPerPixel=2.*clipW/(projectionMatrix[1][1]*uPixelHeight);
      float cap = butterfly ? 4.0*radius : (thread ? 2.2*radius : (tail ? 2.4*radius : 1.75*radius));
      float halfWidth=clamp(unitPerPixel*(butterfly?14.:(thread?3.2:(tail?8.:3.2))),radius,cap);
      if(vKind>.5){
        if(thread){
          float rr=position.x+.014+.050*(1.-uv.x)+.034*sin((1.-uv.x)*5.5+orbit.y*2.);
          angle += (uv.x-1.)*orbit.z + .07*sin((1.-uv.x)*5.2);
          transformed.x=rr*cos(angle);
          transformed.z=rr*.81*sin(angle);
          transformed.y=position.y-.075*(1.-uv.x)+.046*sin((1.-uv.x)*6.5+orbit.y*2.)+(vKind>7.5?.024:-.024);
        }else{
          if(ribbon) angle += (uv.x-1.)*2.16;
          transformed.x = position.x*cos(angle);
          transformed.z = position.x*.81*sin(angle);
          transformed.y += orbit.z*sin(angle+.54)+.018*sin(2.*angle+orbit.y);
          if(ribbon) transformed.y += halfWidth*vShape.y;
        }
      }`);
    s.vertexShader=s.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
      if(billboard){
        if(thread){
          mvPosition.xy += vec2(0., vShape.y*halfWidth*1.25);
        }else{
          vec2 scale = vKind>1.5 ? vec2(1.18,.74) : vec2(1.);
          if(butterfly) scale = vec2(1.12,1.0);
          if(tail) scale = vec2(1.30,1.30);
          mvPosition.xy += vShape * halfWidth * scale;
        }
        gl_Position = projectionMatrix*mvPosition;
      }`);
    const shape=family==="petal" ? `
      // A notched silk petal and a glint on its folded edge.
      vec2 leaf = vec2(p.x*1.23,p.y+.08);
      float petal = length(leaf)-(.34+.21*leaf.y-.078*exp(-65.*leaf.x*leaf.x)*smoothstep(.05,.28,leaf.y));
      float ink = .79*(1.-smoothstep(-.035,.048,petal));
      float flash = .66*(1.-smoothstep(.06,.20,length(p-vec2(-.12,.16))));`
      : family==="tide" ? `
      // An open pearlescent rim leaves the centre of a bubble almost clear.
      float edge=1.-smoothstep(.025,.13,abs(r-.46));
      float ink=.76*edge+.17*(1.-smoothstep(.22,.47,r));
      float flash=.93*(1.-smoothstep(.055,.18,length(p-vec2(-.24,.28))));`
      : `
      vec2 axes=abs(p);
      float crossLight=pow(max(0.,1.-min(axes.x,axes.y)*5.5),2.)*pow(max(0.,1.-max(axes.x,axes.y)),1.5);
      float ink=.79*crossLight;
      float flash=.96*exp(-36.*r*r);`;
    s.fragmentShader=varying+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 p=vShape;
      float r=length(p);
      float alpha;
      if(vKind>7.5){
        // A fine golden filament that breathes in and out as a whole, with no white pin-points.
        float along=vShape.x*.5+.5;
        float width=abs(vShape.y);
        float core=exp(-14.*width*width);
        float halo=exp(-3.0*width*width);
        float breath=.5+.5*sin(uCoutureTime*1.05+vSpin*3.4);
        alpha=(.22*halo+.62*core)*(.20+.80*along)*(.34+.66*breath)*(.86+.14*vBeat);
        diffuseColor.rgb=mix(vec3(1.,.44,.10),vec3(1.,.84,.34),.50+.50*sin(along*4.4+vSpin*1.7));
      }else if(vKind>6.5){
        // A rose filament, thinner and softer, weaving beside the gold one.
        float along=vShape.x*.5+.5;
        float width=abs(vShape.y);
        float core=exp(-14.*width*width);
        float halo=exp(-3.0*width*width);
        float breath=.5+.5*sin(uCoutureTime*1.22+vSpin*3.7+1.4);
        alpha=(.24*halo+.64*core)*(.18+.82*along)*(.38+.62*breath)*(.86+.14*vBeat);
        diffuseColor.rgb=mix(vec3(1.,.18,.42),vec3(1.,.72,.84),.48+.52*sin(along*4.1+vSpin*1.9));
      }else if(vKind>5.5){
        // Golden star-dust woven through the longer wake.
        float twinkle=pow(max(0.,sin(uCoutureTime*8.2+vSpin*9.1)+.30),7.);
        float glow=exp(-3.4*r*r);
        alpha=(.16+.24*twinkle)*glow*(.72+.28*vBeat);
        alpha*=1.-smoothstep(.72,1.0,r);
        diffuseColor.rgb=mix(vec3(1.,.58,.24),vec3(1.,.97,.84),.30+.64*twinkle);
      }else if(vKind>4.5){
        // A chain of soft rose sparks streams behind the butterfly, always facing the camera.
        float twinkle=pow(max(0.,sin(uCoutureTime*7.4+vSpin*8.6)+.28),7.);
        float glow=exp(-3.2*r*r);
        alpha=(.18+.26*twinkle)*glow*(.72+.28*vBeat);
        alpha*=1.-smoothstep(.72,1.0,r);
        diffuseColor.rgb=mix(vec3(1.,.16,.46),vec3(1.,.92,.98),.28+.66*twinkle);
      }else if(vKind>3.5){
        // A painted glow-butterfly sprite whose wings fold toward the body.
        float flap=.66+.34*abs(cos(uCoutureTime*4.8+vSpin*2.8));
        vec2 suv=vAuraUv;
        suv.x=.5+(suv.x-.5)*flap;
        vec4 sprite=texture2D(uButterflyMap,suv);
        vec4 rim=texture2D(uButterflyRim,suv);
        vec3 blend=mix(sprite.rgb,rim.rgb,.34);
        float lum=dot(blend,vec3(.299,.587,.114));
        vec3 glowSkin=mix(vec3(lum),blend,1.38);
        alpha=clamp(sprite.a*1.35+rim.a*.40,0.,1.)*(.90+.10*vBeat);
        diffuseColor.rgb=glowSkin*(1.08+.20*vBeat);
      }else if(vKind>2.5){
        float along=vShape.x*.5+.5;
        float taper=pow(max(0.,sin(3.141593*along)),1.25);
        float width=abs(vShape.y);
        float plume=exp(-2.9*width*width);
        float line=1.-smoothstep(.05,.30,width);
        float highlight=exp(-65.*(along-.72)*(along-.72));
        alpha=taper*(.29*plume+.41*line+.12*highlight*plume);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),(.36+.34*highlight)*line);
      }else if(vKind>1.5){
        float falloff=max(0.,exp(-3.6*r*r)-.027);
        alpha=(.18+.07*vBeat)*falloff;
      }else if(vKind>.5){
        float cs=cos(vSpin), sn=sin(vSpin);
        p=mat2(cs,-sn,sn,cs)*p;
        ${shape}
        float mist=.27*exp(-4.3*r*r);
        alpha=(mist+ink+flash)*(.58+.38*vBeat);
        diffuseColor.rgb=mix(diffuseColor.rgb, vec3(1.),min(.85,flash)*vBeat);
      }else{
        vec2 axes=abs(p);
        float rays=pow(max(0.,1.-min(axes.x,axes.y)*12.),2.)*pow(max(0.,1.-max(axes.x,axes.y)),2.);
        alpha=(.35*exp(-4.8*r*r)+.66*rays+.8*exp(-68.*r*r))*(.54+.44*vBeat);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),.52*rays);
      }
      if(vKind<2.5)alpha*=1.-smoothstep(.76,1.,r);
      diffuseColor.a*=clamp(alpha,0.,1.);`);
  };
  return m;
}
