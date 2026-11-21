import * as THREE from "three";
import type {AnimalElement} from "../game/ranch";

const types:Record<AnimalElement,number>={metal:0,wood:1,water:2,fire:3,earth:4};
const palettes=[
  [0xffb648,0xe994ff,0xffedb1],[0x38e495,0xff90be,0xf6e4ac],[0x32ccf1,0xa388ff,0xc3f8ff],
  [0xff663c,0xe861a0,0xffe173],[0xe29b48,0xb287f6,0xffd9a4],
].map(p=>p.map(hex=>new THREE.Color(hex)));

/** Four two-sided luminous silk trails and two engraved foot rings per elemental creature. */
function makeRibbons(){
  const capacity=256,resolution=64,step:number[]=[],side:number[]=[],indices:number[]=[];
  for(let i=0;i<=resolution;i++){
    step.push(i/resolution,i/resolution);side.push(-1,1);
    if(i<resolution){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setIndex(indices);geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(step.length*3),3));
  geometry.setAttribute("along",new THREE.Float32BufferAttribute(step,1));
  geometry.setAttribute("across",new THREE.Float32BufferAttribute(side,1));
  const placement=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
  const motion=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("placement",placement);geometry.setAttribute("motion",motion);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,
    uniforms:{mainTint:{value:palettes.map(v=>v[0])},prismTint:{value:palettes.map(v=>v[1])}},
    vertexShader:`
      attribute float along,across;attribute vec4 placement;attribute vec3 motion;
      varying float u,v,band,kind,pulse;
      vec3 trail(float k){
        float time=motion.x, el=motion.y, rail=motion.z;
        float a=k*4.30+time+rail*2.15, rad=.73, h;
        if(rail>3.5){
          a=k*6.283185+time*.13*(rail<4.5?1.:-1.);
          rad=rail<4.5?.79:.91+.038*cos(a*(4.+el));
          h=.055+.006*cos(a*6.);
        }else if(el<.5){
          a=k*4.33+time*.81+rail*1.58;rad=.68+.15*sin(a*2.);
          h=.19+(.25+.74*k)*abs(sin(a*.67+rail*.5));
        }else if(el<1.5){
          a=k*4.64+time*.52+rail*1.57;rad=.61+.20*sin(k*5.5+rail);
          h=.12+1.05*k+.14*sin(a*2.);
        }else if(el<2.5){
          a=k*4.85+time*.72+rail*1.57;rad=.71+.14*cos(a*2.);
          h=.22+.87*k+.145*sin(a*1.8+time*.20);
        }else if(el<3.5){
          a=k*3.4+time*.62+rail*1.57+.32*sin(k*8.+time);
          rad=.83-.54*k;h=.11+1.42*k;
        }else{
          a=k*4.4+time*.42+rail*1.57;
          float sector=6.283185/6.;rad=.79*cos(sector*.5)/cos(mod(a,sector)-sector*.5)+.10*sin(rail);
          h=.18+.71*k+.14*cos(a*3.);
        }
        return placement.xyz+vec3(cos(a)*rad,h,sin(a)*rad)*placement.w;
      }
      void main(){
        u=along;v=across;band=motion.z;kind=motion.y;pulse=motion.x;
        vec4 p=modelViewMatrix*vec4(trail(along),1.);
        vec3 q=(modelViewMatrix*vec4(trail(along+.004),1.)).xyz;
        vec2 t=normalize((q.xy-p.xy)*(-p.z)+p.xy*(q.z-p.z)+vec2(.00001));
        float envelope=band>3.5?1.:sin(3.14159*clamp(along,.005,.995));
        float width=band>3.5?(band<4.5?.025:.017):
          (.064+.051*pow(abs(sin(along*5.+band)),2.))*(band<1.5?1.18:.70);
        p.xy+=vec2(-t.y,t.x)*across*width*placement.w*(.05+.95*envelope);
        gl_Position=projectionMatrix*p;
      }`,
    fragmentShader:`
      uniform vec3 mainTint[5],prismTint[5];varying float u,v,band,kind,pulse;
      void main(){
        int i=int(kind+.1);
        float colour=.20+.69*(.5+.5*sin(u*8.4+band*1.74+pulse*.33));
        vec3 c=mix(mainTint[i],prismTint[i],colour);
        float av=abs(v);
        float arc=exp(-4.3*av*av), filament=exp(-21.*abs(v+.19*sin(u*13.+band)));
        float hem=exp(-24.*abs(av-.53));
        float glint=pow(.5+.5*cos(25.*u-2.*pulse+band),10.);
        float filigree=band>3.5?(band<4.5?.9:smoothstep(-.42,-.15,cos(u*100.53))):(.58+.42*sin(u*7.+band)*sin(u*7.+band));
        float fade=band>3.5?1.:smoothstep(0.,.13,u)*(1.-smoothstep(.84,1.,u));
        float alpha=(arc*.54+filament*.57+hem*.29)*(1.-smoothstep(.76,1.,av))*filigree*fade;
        if(alpha<.015)discard;
        gl_FragColor=vec4(mix(c,vec3(1.),min(.96,filament*.86+hem*.4+glint*arc*.22)),min(alpha,1.));
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=2;
  let count=0;
  return {mesh,begin(){count=0;},write(p:THREE.Vector3,height:number,time:number,el:number){
    for(let i=0;i<6&&count<capacity;i++,count++){
      placement.setXYZW(count,p.x,p.y,p.z,height);motion.setXYZ(count,time,el,i);
    }
  },end(){geometry.instanceCount=count;mesh.visible=count>0;for(const attr of [placement,motion]){attr.clearUpdateRanges();attr.addUpdateRange(0,count*attr.itemSize);attr.needsUpdate=true;}},
  dispose(){geometry.dispose();material.dispose();}};
}

export function createRanchAuras(){
  const ribbons=makeRibbons(),capacity=1152,quad=new THREE.PlaneGeometry(1,1);
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setIndex(quad.index);geometry.setAttribute("position",quad.attributes.position);geometry.setAttribute("uv",quad.attributes.uv);
  const centers=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  const colors=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  const marks=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("center",centers);geometry.setAttribute("tint",colors);geometry.setAttribute("mark",marks);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:`
      attribute vec3 center,tint,mark;varying vec2 p;varying vec3 dye;varying float kind;
      void main(){
        p=uv*2.-1.;dye=tint;kind=mark.y;
        float c=cos(mark.z),s=sin(mark.z);
        vec4 view=modelViewMatrix*vec4(center,1.);
        vec2 axes=mat2(c,s,-s,c)*position.xy*mark.x;
        if(kind>4.5) view=modelViewMatrix*vec4(center+vec3(axes.x,0.,-axes.y),1.);
        else view.xy+=axes;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec2 p;varying vec3 dye;varying float kind;
      void main(){
        float r=length(p),a=atan(p.y,p.x),shape=0.,core=0.,halo=.34*exp(-4.*r);
        if(kind<.5){
          float star=pow(abs(p.x),.54)+pow(abs(p.y),.54);shape=1.-smoothstep(.65,.85,star);
          core=exp(-9.*r);halo+=.17*exp(-12.*abs(p.x)-2.5*abs(p.y))+.17*exp(-12.*abs(p.y)-2.5*abs(p.x));
        }else if(kind<1.5){
          float flower=.32+.18*cos(5.*a);shape=1.-smoothstep(.04,.12,r-flower);
          core=exp(-8.*r)+.25*exp(-32.*abs(r-flower));
        }else if(kind<2.5){
          vec2 q=(p-vec2(0.,.12))*vec2(1.25,1.);
          float drop=length(q)-(.41-.17*p.y);shape=1.-smoothstep(.025,.080,abs(drop));core=.8*exp(-20.*length(p-vec2(-.21,.32)));
        }else if(kind<3.5){
          float rim=length(vec2((p.x+.18*sin(p.y*3.))*(1.8+.9*p.y),p.y*1.23));
          shape=1.-smoothstep(.44,.65,rim);core=1.-smoothstep(.14,.43,rim);
        }else if(kind<4.5){
          float d=abs(p.x)*1.7+abs(p.y);shape=1.-smoothstep(.63,.79,d);core=.6*exp(-19.*abs(p.x-.15*p.y))+.31*step(0.,p.x);
        }else{
          // A seal lies on the ground, so it foreshortens under the hooves as the camera orbits.
          float e=kind-5., n=e<.5?8.:e<1.5?5.:e<2.5?3.:6.;
          float sector=6.283185/n, petal=cos(n*a);
          float radius=.66+.069*petal;
          if(e<.5 || e>3.5) radius=.71*cos(sector*.5)/cos(mod(a,sector)-sector*.5);
          else if(e>1.5 && e<2.5) radius+=.024*sin(2.*n*a);
          else if(e>2.5) radius+=.044*pow(.5+.5*petal,4.);
          float edge=abs(r-radius), aa=max(.006,fwidth(r)*.8);
          float line=1.-smoothstep(aa,aa*2.1,edge);
          float dashed=(1.-smoothstep(.006,.015+aa,abs(r-.80)))*smoothstep(-.35,.2,cos(a*36.));
          float rays=pow(max(0.,petal),14.)*exp(-30.*abs(r-.60));
          float rim=exp(-22.*edge);
          float alpha=(.18*exp(-3.6*r*r)+.23*rim+.57*line+.48*dashed+.52*rays)*(1.-smoothstep(.83,.99,r));
          if(alpha<.012)discard;
          gl_FragColor=vec4(mix(dye,vec3(1.),min(.91,.54*line+.63*rays+.39*dashed)),min(.94,alpha));
          #include <colorspace_fragment>
          return;
        }
        float alpha=(shape*.9+halo)*(1.-smoothstep(.79,1.,r));
        if(alpha<.015)discard;
        gl_FragColor=vec4(mix(dye,vec3(1.),clamp(core,0.,1.)),min(alpha,1.));
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=3;mesh.add(ribbons.mesh);
  let count=0;
  function spark(x:number,y:number,z:number,size:number,kind:number,angle:number,tint:THREE.Color){
    if(count>=capacity)return;
    centers.setXYZ(count,x,y,z);colors.setXYZ(count,tint.r,tint.g,tint.b);marks.setXYZ(count,size,kind,angle);count++;
  }
  return {mesh,begin(){count=0;ribbons.begin();},
    animal(p:THREE.Vector3,height:number,element:AnimalElement,t:number,phase:number){
      const el=types[element],pal=palettes[el],time=t*(el===3?.84:.56)+phase;
      ribbons.write(p,height,time,el);
      spark(p.x,p.y+.028,p.z,height*2.52,5+el,time*.12,pal[0]);
      for(let i=0;i<21;i++){
        const life=(i*.618034+time*.21)%1,a=i*2.4+time*.83;
        const radius=(el===3?.78-.47*life:.76+.18*Math.sin(a*2.14))*height;
        const h=(.10+life*(el===3?1.5:1.32))*height;
        const pulse=Math.sin(Math.PI*life),size=(i%3===0?.25:.125)*(.34+pulse*.89)*height;
        spark(p.x+Math.cos(a)*radius,p.y+h,p.z+Math.sin(a)*radius,size,i%3===0?el:0,a*.48,pal[i%3]);
      }
    },
    burst(p:THREE.Vector3,t:number,element:AnimalElement|null){
      const pal=palettes[element?types[element]:0];
      for(let i=0;i<32;i++){
        const a=i*2.4+t*2.5,r=(.20+t*1.18)*(.72+.28*Math.cos(i));
        spark(p.x+r*Math.cos(a),p.y+.12+t*(1.46+i%5*.21),p.z+r*Math.sin(a),.29*(1-t)+.033,i%4?0:4,a,pal[i%3]);
      }
    },end(){ribbons.end();geometry.instanceCount=count;mesh.visible=count>0;for(const attr of [centers,colors,marks]){attr.clearUpdateRanges();attr.addUpdateRange(0,count*3);attr.needsUpdate=true;}},
    dispose(){ribbons.dispose();geometry.dispose();material.dispose();quad.dispose();},
  };
}
