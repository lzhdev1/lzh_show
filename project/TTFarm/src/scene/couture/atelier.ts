import * as T from "three";
import type { COUTURE, CoutureFamily } from "../../game/couture";
import { buildDanceShoes, type ShoeStyle } from "./danceShoes";
import { auraMaterial, weaveAura } from "./aura";

export type V = [number, number, number];
export type Bind = "torso" | "head" | "skirt" | "arm" | "leg" | "foot";
export type Fabric = "satin" | "tulle" | "lace" | "metal" | "glow";
export type Ring = [height: number, width: number, depth: number, centerZ?: number];
type Surface = Fabric | "halo";
type Design = (typeof COUTURE)[number];
interface Batch {
  p: number[]; rgb: number[]; bones: number[]; weights: number[]; uv: number[]; indices: number[]; hem: number[];
}
interface Skirt {
  waist?: number; hem: number; width: number; depth?: number; color: number; fabric?: Fabric;
  pleats?: number; wave?: number; train?: number; slant?: number; trim?: number;
}
const tau = 2 * Math.PI;
const smooth = T.MathUtils.smoothstep;
const mix = T.MathUtils.lerp;
const ellipse = (y: number, w: number, d: number, z = 0, x = 0, n = 40): V[] =>
  Array.from({ length: n }, (_, i) => [x+w*Math.sin(i*tau/n), y, z+d*Math.cos(i*tau/n)]);
const time = { value: 0 };
const motionPreference = typeof matchMedia==="function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

function textile(fabric: Surface,family:CoutureFamily): T.Material {
  if (fabric === "halo") return auraMaterial(family,time);
  if (fabric === "glow") return new T.MeshBasicMaterial({vertexColors:true, side:T.DoubleSide,toneMapped:false});
  const sheer = fabric === "lace" || fabric === "tulle";
  const m = new T.MeshPhysicalMaterial({
    vertexColors:true, side:T.DoubleSide, transparent:sheer, depthWrite:!sheer,
    roughness:fabric==="metal" ? .26 : sheer ? .6 : .35,
    metalness:fabric==="metal" ? .46 : .04,
    sheen:fabric==="satin" ? .78 : .28, sheenColor:0xffe8e3, sheenRoughness:.43,
    specularIntensity:fabric==="metal" ? .95 : .5, opacity:sheer ? .38 : 1,
  });
  m.forceSinglePass = true;
  if (sheer || fabric==="satin") {
    m.customProgramCacheKey = () => "couture-" + fabric + "-" + family;
    m.onBeforeCompile = shader => {
      shader.uniforms.uStitchTime=time;
      shader.vertexShader = "attribute float hem; varying float vHem; varying vec3 vTextile;\n"+
        shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvTextile = position; vHem = hem;");
      shader.fragmentShader = "uniform float uStitchTime; varying float vHem; varying vec3 vTextile;\n"+shader.fragmentShader;
      // The pattern is measured up from each individual hem. It follows cutaway
      // petals and asymmetrical trains while the skinning deforms the cloth.
      const stitching = `
        float theta = atan(vTextile.x,vTextile.z) * .159154943;
        float phase = 6.283185 * theta * ${family==="petal"?"12.":family==="tide"?"10.":"14."};
        float margin = max(fwidth(vHem)*.67,.0008);
        float stem = ${family==="petal"?".026+.012*cos(phase)":family==="tide"?".03+.012*sin(phase)":".018+.026*abs(fract(theta*14.)*2.-1.)"};
        float stem2 = ${family==="petal"?".027+.009*cos(phase+1.55)":family==="tide"?".029+.012*sin(phase+.92)":".053-.026*abs(fract(theta*14.)*2.-1.)"};
        float piping = 1.-smoothstep(.001,.001+margin,min(abs(vHem-.009),abs(vHem-.056)));
        float vine = 1.-smoothstep(.0012,.0012+margin,min(abs(vHem-stem),abs(vHem-stem2)));
        float bead = (1.-smoothstep(.001,.003+margin,abs(vHem-.046)))*smoothstep(.8,.98,cos(phase));
        float brocade = max(max(vine*.72,piping*.60),bead);
        vec3 embroidery = mix(vec3(1.,.84,.69),vec3(.82,.94,1.),${family==="petal"?".1":family==="tide"?".8":".52"});
        float lustre = .73 + .27*sin(phase*.25-uStitchTime*.76);
        vec3 silkThread = mix(outgoingLight,embroidery,.52);
        outgoingLight = mix(outgoingLight,silkThread*(.79+.25*lustre),brocade*.83);
        ${sheer?"diffuseColor.a = max(diffuseColor.a, brocade*.78);":""}
      `;
      const surface = sheer ? `
        float facing = abs(dot(normal,normalize(vViewPosition)));
        float rim = pow(1.-min(1.,facing),2.);
        vec2 weave = vec2(vTextile.y*90.,(vTextile.x+vTextile.z*.65)*80.);
        vec2 angle = vec2(weave.x+weave.y, weave.x-weave.y);
        vec2 thread = 1.-smoothstep(vec2(.05), max(vec2(.09), fwidth(angle)*.8), abs(fract(angle)-.5));
        float threadStrength = max(thread.x,thread.y) * (1.-smoothstep(.25,.8,max(fwidth(angle.x),fwidth(angle.y))));
        diffuseColor.a = ${fabric==="lace" ? ".34+.19*threadStrength+.24*rim" : ".20+.10*threadStrength+.28*rim"};
        float veil = .5+.5*cos(vTextile.y*7.5 + vTextile.x*4. + facing*3.);
        vec3 pearl = mix(vec3(.66,.85,1.),vec3(1.,.78,.87),veil);
        outgoingLight += .27*rim*pearl + .055*pearl*veil + vec3(.034)*threadStrength;` : `
        float edgeLight = pow(1.-abs(dot(normal,normalize(vViewPosition))),2.);
        float fold = .5+.5*sin((vTextile.y+vTextile.x*.61+vTextile.z*.30)*21. + normal.x*2. + normal.y);
        float silk = pow(fold,3.)*(.27+.73*edgeLight);
        outgoingLight += diffuseColor.rgb*(edgeLight*.16-.06*(1.-fold)) + .14*silk*mix(diffuseColor.rgb,vec3(1.),.32);`;
      const pearlescence = `
        float biasCut = dot(vTextile,vec3(.48,1.,-.27));
        float shimmer = pow(.5+.5*cos(biasCut*8.3-uStitchTime*.94),7.);
        vec3 luminousThread = mix(diffuseColor.rgb,vec3(1.,.9,.95),.40);
        outgoingLight += luminousThread*shimmer*${sheer?".13":".073"};
      `;
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",surface+"\n"+stitching+"\n"+pearlescence+"\n#include <opaque_fragment>");
    };
  }
  return m;
}

/** All coordinates are in the bundled VRM's T-pose. Batching by finish keeps
 * seams, beads and embroidery on the same skeleton without separate draws. */
export class Atelier {
  private readonly batches = new Map<Surface,Batch>();
  private readonly bones: Map<string,number>;
  private readonly tint = new T.Color();
  private readonly hemLights:V[]=[];
  private readonly radii:number[]=[];
  private readonly orbits:number[]=[];
  private width=.18;
  private hem=.82;
  liningColor?: number;
  constructor(private readonly body: T.SkinnedMesh, private readonly design: Design) {
    this.bones = new Map(body.skeleton.bones.map((b,i) => [b.name.replace("J_Bip_",""),i]));
  }
  private batch(f: Surface) {
    let b = this.batches.get(f);
    if (!b) { b={p:[],rgb:[],bones:[],weights:[],uv:[],indices:[],hem:[]}; this.batches.set(f,b); }
    return b;
  }
  private vertex(b:Batch, p:V, color:number, bind:Bind|"hips", u:number, v:number, hem=-1) {
    const [x,y]=p, side=x>=0?"L_":"R_";
    const joint=(n:string)=>this.bones.get(n)!;
    let names:string[], weights:number[];
    if (bind==="hips") {
      names=["C_Hips"]; weights=[1];
    } else if (bind==="head" || bind==="foot") {
      names=[bind==="head"?"C_Head":side+"Foot"]; weights=[1];
    } else if (bind==="arm") {
      const elbow=smooth(Math.abs(x),.295,.39), shoulder=smooth(Math.abs(x),.115,.18);
      names=["C_UpperChest",side+"UpperArm",side+"LowerArm"]; weights=[1-shoulder,shoulder*(1-elbow),shoulder*elbow];
    } else if (bind==="torso") {
      const upper=smooth(y,1.07,1.23), mid=smooth(y,.926,1.07);
      names=["C_Hips","C_Chest","C_UpperChest"]; weights=[1-mid,mid*(1-upper),mid*upper];
    } else if (bind==="skirt") {
      const hip=smooth(y,.60,.955), left=smooth(x,-.12,.12);
      const shin=(1-smooth(y,.28,.56))*.77;
      if(shin>0){
        names=["L_UpperLeg","R_UpperLeg","L_LowerLeg","R_LowerLeg"];
        weights=[(1-shin)*left,(1-shin)*(1-left),shin*left,shin*(1-left)];
      }else{
        names=["C_Hips","L_UpperLeg","R_UpperLeg"];
        weights=[hip,(1-hip)*left,(1-hip)*(1-left)];
      }
    } else {
      const hip=smooth(y,.74,.96), knee=smooth(y,.44,.55), ankle=1-smooth(y,.07,.135);
      names=[side+"Foot",side+"LowerLeg",side+"UpperLeg","C_Hips"];
      weights=[ankle,(1-ankle)*(1-knee),knee*(1-hip),hip];
    }
    b.p.push(...p); this.tint.setHex(color).toArray(b.rgb,b.rgb.length); b.uv.push(u,v); b.hem.push(hem);
    for(let i=0;i<4;i++){b.bones.push(i<names.length?joint(names[i]):0); b.weights.push(weights[i]??0);}
  }
  shell(rows:V[][], color:number, fabric:Fabric, bind:Bind, wrap=true, embroider=true) {
    if (rows.length<2 || rows[0].length<2) return;
    const b=this.batch(fabric), width=rows[0].length, first=b.p.length/3;
    const border=embroider && bind==="skirt" && width>=7 && rows.length>=3
      ? rows[0].map((_,k)=>Math.min(...rows.map(row=>row[k][1]))) : null;
    if(border && Math.abs(rows[0][0][1]-rows[rows.length-1][0][1])>.12){
      const hem=rows[0][0][1]<rows[rows.length-1][0][1]?rows[0]:rows[rows.length-1];
      const stitches=wrap?[.10,.37,.61,.87]:[.5];
      for(const t of stitches){
        const p=hem[Math.floor(t*width)];
        if(this.hemLights.length>=12 || this.hemLights.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<.12)) continue;
        this.hemLights.push(p);
        const tint=this.tint.setHex(color).lerp(new T.Color(0xffeaca),.45).getHex();
        this.spark([p[0]*1.008,p[1]+.006,p[2]*1.008],.039,tint,"skirt");
      }
    }
    const silhouette=bind==="skirt" && (fabric==="satin" || fabric==="lace" || fabric==="tulle");
    for(let j=0;j<rows.length;j++) for(let k=0;k<width;k++){
      const point=rows[j][k];
      if(silhouette){
        this.hem=Math.min(this.hem,point[1]);
        this.width=Math.max(this.width,Math.abs(point[0]));
      }
      this.vertex(b,point,color,bind,k/(wrap?width:width-1),j/(rows.length-1),border?point[1]-border[k]:-1);
      if (!j || (!wrap && k===width-1)) continue;
      const a=first+(j-1)*width+k, next=first+(j-1)*width+(k+1)%width;
      b.indices.push(a,next,a+width,next,next+width,a+width);
    }
  }
  ring(rows:Ring[], color:number,fabric:Fabric,bind:Bind) {
    this.shell(rows.map(([y,w,d,z])=>ellipse(y,w,d,z)),color,fabric,bind);
  }
  tube(path:V[],radius:number,color:number,fabric:Fabric,bind:Bind) {
    const pts=path.map(p=>new T.Vector3(...p)).filter((p,i,a)=>!i || p.distanceToSquared(a[i-1])>1e-12);
    if (pts.length<2) return;
    let frame = new T.Vector3(0,0,1);
    const rows = pts.map((p,i)=>{
      const tangent=pts[Math.min(pts.length-1,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize();
      if (Math.abs(tangent.dot(frame))>.96) frame = new T.Vector3(Math.abs(tangent.y)<.85?0:1,Math.abs(tangent.y)<.85?1:0,0);
      frame.addScaledVector(tangent,-tangent.dot(frame)).normalize();
      const cross=new T.Vector3().crossVectors(tangent,frame);
      return Array.from({length:6},(_,k):V=>p.clone().addScaledVector(frame,radius*Math.cos(k*tau/6)).addScaledVector(cross,radius*Math.sin(k*tau/6)).toArray() as V);
    });
    this.shell(rows,color,fabric,bind,true,false);
  }
  private stone(p:V,r:V,color:number,fabric:Fabric,bind:Bind,columns:number,levels:number) {
    const rows=Array.from({length:levels+1},(_,j)=>{
      const t=(j/levels-.5)*Math.PI, c=Math.max(.01,Math.cos(t));
      return ellipse(p[1]+r[1]*Math.sin(t),r[0]*c,r[2]*c,p[2],p[0],columns);
    });
    this.shell(rows,color,fabric,bind,true,false);
  }
  gem(p:V,r:V,color:number,fabric:Fabric,bind:Bind) {
    this.stone(p,r,color,fabric,bind,6,3);
    if(fabric==="glow") this.spark(p,Math.min(.078,Math.max(...r)*2.8),color,bind);
  }
  pearl(p:V,r:V,color:number,fabric:Fabric,bind:Bind) { this.stone(p,r,color,fabric,bind,12,7); }
  spark(p:V,size:number,color:number,bind:Bind) {
    const b=this.batch("halo"), n=b.p.length/3;
    for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) {
      this.vertex(b,p,color,bind,u,v); this.radii.push(Math.max(.032,size)); this.orbits.push(0,0,0,0);
    }
    b.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  bodice(color:number,trim:number,neck:"sweetheart"|"jewel"|"halter"|"square"|"wrap") {
    const profiles:Ring[]=[[.906,.145,.121,.004],[.952,.139,.119,.006],[1.021,.120,.116,.006],
      [1.075,.124,.114,.005],[1.141,.143,.129,.002],[1.188,.145,.119,.001],[1.23,.142,.097,-.003]];
    const rows=profiles.map(([y,w,d,z])=>ellipse(y,w,d,z));
    const rim=rows[rows.length-1].map(([x,,z],i):V=>{
      const front=Math.max(0,Math.cos(i*tau/40)), side=Math.abs(Math.sin(i*tau/40));
      let y=1.232+.02*side;
      if(neck==="sweetheart")y+=front*(.026*Math.sin(side*Math.PI)-.036*(1-side));
      if(neck==="wrap")y+=x*.20-.018*front;
      if(neck==="square")y-=front*.025;
      if(neck==="jewel" || neck==="halter")return [x*(neck==="jewel"?.56:.39),1.302-.015*front,z*.72-.012];
      return [x,y,z];
    });
    rows[rows.length-1]=rim; this.shell(rows,color,"satin","torso");
    this.tube([...rim,rim[0]],.0036,trim,"metal","torso");
    for(const s of [-1,1]){
      const x=s*.094;
      if(neck!=="jewel" && neck!=="halter"){
        const path:V[]=[[x,1.221,.080],[s*.114,1.273,.053],[s*.119,1.303,-.02],[s*.111,1.284,-.063],[x,1.225,-.077]];
        this.shell(path.map(([a,y,z])=>[[a-.009,y,z],[a+.009,y,z]]),color,"satin","torso",false);
      }
    }
  }
  skirt(o:Skirt) {
    if(this.liningColor===undefined && (!o.fabric || o.fabric==="satin"))this.liningColor=o.color;
    const waist=o.waist??.96, d=o.depth??o.width*.76, pleats=o.pleats??10, n=64, steps=9;
    const rows=Array.from({length:steps},(_,j)=>{
      const t=1-j/(steps-1), flare=Math.pow(t,.73);
      return Array.from({length:n},(_,i):V=>{
        const a=i*tau/n, fold=1+t*(.035*Math.cos(pleats*a)+.014*Math.cos(pleats*a*2+.55));
        return [Math.sin(a)*mix(.14,o.width,flare)*fold,
          mix(waist,o.hem,t)+t*t*((o.wave??.008)*Math.cos(pleats*a)+(o.slant??0)*Math.sin(a)-(o.train??0)*Math.pow((1-Math.cos(a))*.5,2)),
          .003+Math.cos(a)*mix(.116,d,flare)*fold];
      });
    });
    this.shell(rows,o.color,o.fabric??"satin","skirt");
    if (o.trim!==undefined) this.tube([...rows[0],rows[0][0]],.0038,o.trim,"metal","skirt");
  }
  sleeves(style:"puff"|"bell"|"ribbon"|"glove"|"cap",color:number,trim:number,fabric:Fabric="satin",side?:-1|1) {
    const profiles = {
      puff:[[.132,.045],[.164,.075],[.207,.083],[.24,.064],[.255,.042]],
      cap:[[.13,.041],[.16,.061],[.197,.062],[.222,.049]],
      bell:[[.159,.054],[.234,.055],[.333,.049],[.403,.066],[.486,.103]],
      glove:[[.332,.045],[.377,.044],[.473,.032],[.526,.029],[.552,.03]],
      ribbon:[[.163,.054],[.194,.055],[.225,.047]],
    }[style];
    for(const s of side?[side]:[-1,1]){
      const rows=profiles.map(([x,r])=>Array.from({length:24},(_,i):V=>{
        const a=i*tau/24, fold=style==="puff"||style==="bell"?1+.055*Math.cos(8*a):1;
        return [x*s,1.274+r*fold*Math.sin(a),-.024+r*fold*Math.cos(a)];
      }));
      this.shell(rows,color,fabric,"arm");
      const rim=rows[rows.length-1]; this.tube([...rim,rim[0]],.0036,trim,"metal","arm");
    }
  }
  shoes(color:number,trim:number,style:ShoeStyle="pump") {
    buildDanceShoes(this,color,trim,style);
  }
  bow(p:V,size:number,color:number,bind:Bind){
    const [x,y,z]=p;
    for(const s of [-1,1]){
      const rows=Array.from({length:8},(_,i)=>{
        const t=i/7, w=size*(.07+.35*Math.sin(t*2.04));
        return Array.from({length:12},(_,j):V=>[x+s*size*t,y+size*.21*t+w*Math.sin(j*tau/12),z+w*.45*Math.cos(j*tau/12)]);
      });
      this.shell(rows,color,"satin",bind);
      this.shell(Array.from({length:6},(_,i):V[]=>{
        const t=i/5, cx=x+s*size*(.15+.56*t), cy=y-size*t*.99, cz=z+size*.1*Math.sin(t*Math.PI);
        return [[cx-size*.13,cy,cz],[cx+size*.13,cy-size*.13*t,cz+.003]];
      }),color,"satin",bind,false);
    }
    this.pearl(p,[size*.17,size*.16,size*.15],color,"satin",bind);
  }
  mount():()=>void {
    const garments:T.SkinnedMesh<T.BufferGeometry,T.Material>[]=[];
    const lights=this.batch("halo");
    weaveAura(this.design.id,this.design.family,this.design.swatch,this.width,this.hem,(p,size,color,[u,v],orbit)=>{
      const i=lights.p.length/3;
      this.vertex(lights,p,color,"hips",u,v);
      this.radii.push(size); this.orbits.push(...orbit);
      return i;
    },lights.indices);
    for(const [finish,b] of this.batches){
      const g=new T.BufferGeometry();
      g.setAttribute("position",new T.Float32BufferAttribute(b.p,3));
      g.setAttribute("uv",new T.Float32BufferAttribute(b.uv,2));
      g.setAttribute("color",new T.Float32BufferAttribute(b.rgb,3));
      g.setAttribute("hem",new T.Float32BufferAttribute(b.hem,1));
      g.setAttribute("skinIndex",new T.Uint16BufferAttribute(b.bones,4));
      g.setAttribute("skinWeight",new T.Float32BufferAttribute(b.weights,4));
      if(finish==="halo"){
        g.setAttribute("radius",new T.Float32BufferAttribute(this.radii,1));
        g.setAttribute("orbit",new T.Float32BufferAttribute(this.orbits,4));
      }
      g.setIndex(b.indices); g.computeVertexNormals();
      const mesh=new T.SkinnedMesh(g,textile(finish,this.design.family));
      mesh.name="couture-"+finish; mesh.frustumCulled=false;
      mesh.renderOrder=finish==="halo"?5:finish==="lace"?4:finish==="tulle"?3:0;
      mesh.castShadow=finish==="satin"||finish==="metal";
      mesh.onBeforeRender=()=>{time.value=motionPreference?.matches?0:performance.now()*.001;};
      mesh.bind(this.body.skeleton,this.body.bindMatrix);
      this.body.parent!.add(mesh); garments.push(mesh);
    }
    return ()=>{for(const mesh of garments){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}};
  }
}
