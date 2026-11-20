import * as T from "three";
import type { CoutureFamily, CoutureId } from "../../game/couture";
import type { V } from "./atelier";

// kind 0 is a sequin sewn onto the cloth, 1 a passing petal/bubble/star,
// 2 a diffuse patch of light, and 3 a short ribbon with tapered ends.
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
    const t=((i*7+2)%13)/13, y=T.MathUtils.lerp(floor+.06,1.20,t);
    const angle=phase+i*goldenAngle;
    const speed=palette.speed*(.75+.12*(i%4));
    const size=i%4===0?.055:i%3===0?.039:.027;
    mote(y,radiusAt(y)+(.015*(i%3)),size,i%3===0?palette.glint:main,[speed,angle,palette.rise*.55,1]);
  }
  // Broader, very low-opacity glows slip across the outside of the silhouette.
  for(let i=0;i<5;i++){
    const y=T.MathUtils.lerp(floor+.05,1.17,i/5);
    mote(y,radiusAt(y)-.032,.135+i%2*.022,main,[palette.speed*.82,phase+i*goldenAngle,.052,2]);
  }
  for(let strand=0;strand<2;strand++){
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
}

export function auraMaterial(family:CoutureFamily,time:T.IUniform<number>) {
  const m=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,
    side:T.DoubleSide,toneMapped:false,premultipliedAlpha:true});
  m.forceSinglePass=true;
  m.customProgramCacheKey=()=>"couture-aura-"+family;
  const bufferSize=new T.Vector2();
  const resolution={value:1};
  m.onBeforeRender=renderer=>{resolution.value=renderer.getDrawingBufferSize(bufferSize).y;};
  m.onBeforeCompile = s=>{
    s.uniforms.uCoutureTime=time;
    s.uniforms.uPixelHeight=resolution;
    const varying="varying vec2 vShape; varying float vKind; varying float vBeat; varying float vSpin; uniform float uCoutureTime;\n";
    s.vertexShader=varying+"attribute vec4 orbit; attribute float radius; uniform float uPixelHeight;\n"+s.vertexShader;
    s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vShape = uv * 2. - 1.;
      vKind = orbit.w;
      float angle = orbit.y + orbit.x*uCoutureTime;
      vSpin = .36*sin(angle*1.3) + orbit.y;
      vBeat = .5+.5*sin(uCoutureTime*1.8 + (vKind<.5 ? dot(position,vec3(21.,49.,37.)) : orbit.y*2.));
      // Keep the fine moving filaments readable when the farm camera pulls out.
      float clipW=abs((projectionMatrix*modelViewMatrix*vec4(position,1.)).w);
      float unitPerPixel=2.*clipW/(projectionMatrix[1][1]*uPixelHeight);
      float halfWidth=clamp(unitPerPixel*(vKind>2.5?2.2:2.8),radius,1.75*radius);
      if(vKind>.5){
        if(vKind>2.5) angle += (uv.x-1.)*2.16;
        transformed.x = position.x*cos(angle);
        transformed.z = position.x*.81*sin(angle);
        transformed.y += orbit.z*sin(angle+.54)+.018*sin(2.*angle+orbit.y);
        if(vKind>2.5) transformed.y += halfWidth*vShape.y;
      }`);
    s.vertexShader=s.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
      if(vKind<2.5){
        vec2 scale = vKind>1.5 ? vec2(1.18,.74) : vec2(1.);
        mvPosition.xy += vShape * halfWidth * scale;
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
      if(vKind>2.5){
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
