import * as THREE from "three";
import { ELEMENTS, MUTATIONS, SPIRITS, type Mutation } from "../game/weather";

const motifs = [...ELEMENTS, ...SPIRITS] as const;
const PER_PLOT = 22, CELL = 64;

function motifTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CELL*4;
  const ctx = canvas.getContext("2d")!;
  for (const [index, mutation] of motifs.entries()) {
    ctx.save();
    ctx.translate((index%4+.5)*CELL,(Math.floor(index/4)+.5)*CELL);
    ctx.lineWidth = 2.5;
    ctx.lineCap = ctx.lineJoin = "round";
    const tint = "#" + MUTATIONS[mutation].fruit.toString(16).padStart(6,"0");
    const bloom = ctx.createRadialGradient(0,0,0,0,0,29);
    bloom.addColorStop(0,tint+"bc"); bloom.addColorStop(.33,tint+"61"); bloom.addColorStop(1,tint+"00");
    ctx.fillStyle=bloom; ctx.fillRect(-32,-32,64,64);
    ctx.fillStyle=tint; ctx.strokeStyle="#fff7dc"; ctx.shadowColor=tint; ctx.shadowBlur=6;
    function glyph(path: string, fill = true) {
      const shape = new Path2D(path);
      if(fill) ctx.fill(shape);
      ctx.stroke(shape);
    }
    switch(mutation) {
      case "thunder": glyph("M5 -23L-13 2H-2L-8 22L15 -6H4Z"); break;
      case "frost":
        for(let j=0;j<6;j++){glyph("M0 0V-20M0 -10L-5 -15M0 -10L5 -15",false); ctx.rotate(Math.PI/3);}
        break;
      case "flame": glyph("M1 -21C0 -12 13 -7 7 1Q13 -2 14 -6C23 10 8 22 -3 19C-21 15 -19 1 -12 -5Q-12 3 -7 4Q-10 -8 1 -21Z");break;
      case "gold": glyph("M0 -22L15 -3L0 21L-15 -3ZM-15 -3H15M0 -22L-5 -3L0 21L5 -3Z");break;
      case "earth": glyph("M0 19L-14 8L-7 -1L0 2L9 -3L15 8ZM0 2C-17 0 -18 -9 -17 -13Q-3 -13 0 -3Q4 -17 17 -17Q16 -3 0 2");break;
      case "wind": glyph("M-20 5C-12 -9 -3 -12 9 -8Q22 -4 22 -15C23 5 8 6 -1 4Q-11 2 -20 5ZM-14 11Q-2 6 6 10Q13 15 18 7",false);break;
      case "rosette":
        for(let j=0;j<5;j++){glyph("M0 -1C-13 -10 -7 -24 0 -17C10 -24 12 -10 0 -1Z");ctx.rotate(Math.PI*2/5);}
        break;
      case "nocturne": glyph("M8 -20C-13 -19 -21 3 -7 15Q5 25 19 12Q5 17 -2 6Q-9 -9 8 -20Z");break;
      case "coral": glyph("M0 -20C2 -12 16 0 14 9C12 22 -10 23 -14 10C-18 0 -4 -11 0 -20ZM-8 5Q-7 13 1 14");break;
      case "orbit": glyph("M0 -19L4 -6L17 -9L10 2L18 13L4 10L-3 22L-5 8L-20 8L-9 -2L-15 -13L-2 -9Z");break;
      case "bamboo": glyph("M-15 20L11 -21M-6 7Q-19 5 -17 -8Q-6 -5 -6 7M1 -4Q3 -17 13 -20Q16 -8 1 -4M-3 6Q6 -4 18 -2Q13 8 -3 6",false);break;
    }
    ctx.restore();
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

/** 全部菜地共用一次绘制。只在作物阶段变化时上传该地块的图案和亮度。 */
export function createCropAuras(centers: THREE.Vector3[]) {
  const count = centers.length*PER_PLOT;
  const centersAndSeed = new Float32Array(count*3), kinds = new Float32Array(count*2);
  for(const [id, center] of centers.entries()) {
    for(let j=0;j<PER_PLOT;j++) {
      const i=id*PER_PLOT+j;
      centersAndSeed.set([center.x,(j+.5)/PER_PLOT,center.z],i*3);
      kinds[i*2]=-1;
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(centersAndSeed,3));
  const state=new THREE.BufferAttribute(kinds,2).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("motif",state);
  const texture=motifTexture();
  const uniforms={t:{value:0},pixelScale:{value:180},atlas:{value:texture}};
  const mat=new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, toneMapped:false,
    vertexShader:`
      uniform float t,pixelScale; attribute vec2 motif;
      varying float tile,alpha,rotation,spark;
      void main(){
        tile=motif.x; float stage=motif.y;
        if(tile<0. || position.y>stage){ gl_Position=vec4(4.,4.,4.,1.); gl_PointSize=1.; alpha=0.; rotation=0.; spark=0.; return; }
        spark=mod(floor(position.y*22.),3.);
        float seed=fract(position.y*173.31+.13*position.x-.09*position.z);
        float clock=t+position.x*.17;
        float age=fract(seed+clock*(tile==2.?.48:.25));
        float phi=position.y*59.71+clock*(tile==5.?2.45:.83);
        float radius=(.38+.46*seed)*(.55+stage*.5);
        float h=.24+age*(tile>=6.?1.61:.98)*(stage+.06);
        if(tile==0.){ phi+=.12*floor(age*7.); h=.28+.17*floor(age*6.);}
        if(tile==1.){ h=.35+(1.-age)*1.07; phi+=.13*sin(clock*1.3); }
        if(tile==2.) radius*=1.-age*.60;
        if(tile==3.) h=.31+.65*seed+.13*sin(phi*2.);
        if(tile==4.) h=.21+.62*pow(age,1.6);
        if(tile==5.){h=.26+age*1.05;radius+=.30*age;}
        float glint=sin(3.14159*age);
        alpha=(.28+.69*glint)*(.55+.45*stage);
        rotation=tile==0.?0.:sin(phi)*.35;
        vec3 p=vec3(position.x+radius*cos(phi),h,position.z+radius*sin(phi));
        vec4 eye=viewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*eye;
        float size=spark<.5?.78:(spark<1.5?.39:.22);
        gl_PointSize=clamp(pixelScale*(.5+.55*seed)*(.62+.5*glint)*size/max(1.,-eye.z),2.,40.);
      }`,
    fragmentShader:`
      uniform sampler2D atlas; varying float tile,alpha,rotation,spark;
      void main(){
        vec2 p=gl_PointCoord-.5; float c=cos(rotation),s=sin(rotation);
        p=mat2(c,-s,s,c)*p+.5;
        if(min(p.x,p.y)<0. || max(p.x,p.y)>1.)discard;
        vec2 cell=vec2(mod(tile,4.),floor(tile/4.));
        vec2 uv=(cell+p)/4.; uv.y=1.-uv.y;
        vec4 pixel=texture2D(atlas,uv);
        if(spark>.5) {
          vec2 d=abs(p-.5)*2.;
          float ray=1.-smoothstep(.03,.21,pow(d.x,.64)*pow(d.y,.64)*4.);
          float glow=exp(-3.*dot(d,d));
          vec2 center=(cell+.5)/4.; center.y=1.-center.y;
          vec3 hue=texture2D(atlas,center).rgb;
          pixel=vec4(mix(hue,vec3(1.),.42),(.75*ray+.35*glow)*(1.-smoothstep(.42,1.,length(d))));
        }
        if(pixel.a*alpha<.025)discard;
        gl_FragColor=vec4(pixel.rgb,pixel.a*alpha);
        #include <colorspace_fragment>
      }`,
  });
  const points=new THREE.Points(geo,mat);
  points.frustumCulled=false; points.renderOrder=2; points.visible=false;
  const active=new Set<number>();
  return {points,
    setTime(t:number) { uniforms.t.value=t;uniforms.pixelScale.value=Math.min(330,window.innerHeight*.43); },
    setPlot(id:number, mutation:Mutation|null, stage:number) {
      const index = mutation === "amber" ? 3 : mutation === "mist" ? 1 : mutation === "pearl" ? 5 : motifs.findIndex(m=>m===mutation);
      const enabled=index>=0 && stage>=0;
      if(enabled) active.add(id); else active.delete(id);
      points.visible=active.size>0;
      for(let j=0;j<PER_PLOT;j++) state.setXY(id*PER_PLOT+j,enabled?index:-1,Math.min(1,.18+stage*.28));
      state.addUpdateRange(id*PER_PLOT*2,PER_PLOT*2);
      state.needsUpdate=true;
    },
    dispose(){texture.dispose();mat.dispose();geo.dispose();},
  };
}
