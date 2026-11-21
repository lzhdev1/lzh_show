import * as THREE from "three";
import type { Spirit } from "../../game/weather";
import type { DollAdd, V } from "./geometry";

type Point = THREE.Vector3;
const TAU = Math.PI * 2;
const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const white = 0xffffff;

// Three paint stops per hairstyle keep its local colour legible under farm lighting.
const dyes = {
  rosette: [0x723c55, 0xc57787, 0xf6b7a6],
  nocturne: [0x48506d, 0x94a0c2, 0xe5e4ef],
  coral: [0x326982, 0x68b4c5, 0xc2ece3],
  orbit: [0x593947, 0x9d6245, 0xe8ae71],
  bamboo: [0x24353b, 0x3a5551, 0x77938a],
} as const;

function surface(rows: number, cols: number, vertex: (t: number, u: number) => [Point, THREE.Color]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let r=0; r<=rows; r++) for (let c=0; c<=cols; c++) {
    const [p, color] = vertex(r/rows, c/cols);
    positions.push(p.x,p.y,p.z); colors.push(color.r,color.g,color.b);
    if (r<rows && c<cols) {
      const i = r*(cols+1)+c, next = i+cols+1;
      indices.push(i,next,i+1, i+1,next,next+1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

const crownY = .948, radiusY = .277;
function frontZ(x: number, y: number) {
  return .234 * Math.sqrt(Math.max(.012,1-(x/.274)**2-((y-crownY)/radiusY)**2))-.006;
}

export function addDollHair(id: Spirit, add: DollAdd) {
  const [shade, dye, silk] = dyes[id].map(hex=>new THREE.Color(hex));
  const cool = id === "nocturne" || id === "coral";
  const part = id === "coral" ? -.012 : id === "orbit" ? -.055 : id === "bamboo" ? .023 : .054;
  const paint = (mid:number, light=0) => shade.clone().lerp(dye,THREE.MathUtils.clamp(mid,0,1)).lerp(silk,light);
  const curve = (v:V[]) => new THREE.CatmullRomCurve3(v.map(q=>point(...q)),false,"centripetal");

  function bead(x:number,y:number,z:number,rx:number,ry:number,rz:number,color:number) {
    add(new THREE.SphereGeometry(1,10,7),color,[x,y,z],undefined,[rx,ry,rz]);
  }
  function wire(v:V[],r:number,color:number,steps=12) {
    add(new THREE.TubeGeometry(curve(v),steps,r,5,false),color);
  }
  function cast(center:(t:number)=>Point, outward:(t:number,p:Point)=>Point, width:(t:number)=>number,
                depth:(t:number)=>number, rows=10, tone=0) {
    // A flattened, ridged lock has a light-facing bevel and a shaded underside.
    const sections = new Map<number,{p:Point; side:Point; top:Point}>();
    const geometry = surface(rows,8,(t,u)=>{
      let basis = sections.get(t);
      if (!basis) {
        const p = center(t), dir = center(Math.min(1,t+.003)).sub(center(Math.max(0,t-.003))).normalize();
        let side = dir.clone().cross(outward(t,p));
        if (side.lengthSq()<.001) side=dir.clone().cross(point(.38,.13,.91));
        side.normalize();
        const top = side.clone().cross(dir).normalize();
        basis={p,side,top}; sections.set(t,basis);
      }
      const angle=TAU*u, c=Math.cos(angle), s=Math.sin(angle);
      const across = width(t)*c;
      const relief = depth(t) * (s>=0 ? s*(.79+.21*(1-Math.abs(c))) : s*.60);
      const p = basis.p.clone().addScaledVector(basis.side,across).addScaledVector(basis.top,relief);
      const glint = Math.max(0,s)*(.07+.24*Math.exp(-Math.pow((t-.35)/.136,2)))*(1-.40*Math.abs(c+.35));
      return [p,paint(.52+.37*s+.09*Math.sin(t*Math.PI)+tone,glint*(cool?1.12:1))];
    });
    add(geometry,white);
  }
  function lock(v:V[],width:number,depth:number,normal:V,tone=0,steps=9) {
    const path=curve(v);
    // Overlapping roots are broad; only the last quarter narrows to a sculpted tip.
    const widthAt=(t:number)=>Math.max(.014,Math.min(1,.42+t*3.8)*(1-.95*t**2.65));
    cast(t=>path.getPoint(t),()=>point(...normal),t=>width*widthAt(t),t=>depth*widthAt(t),steps,tone);
  }
  function bang(a:V,b:V,c:V,w:number,shadeBias=0) {
    const center=(t:number)=>{
      const n=1-t, x=n*n*a[0]+2*n*t*b[0]+t*t*c[0], y=n*n*a[1]+2*n*t*b[1]+t*t*c[1];
      return point(x,y,frontZ(x,y)+n*n*a[2]+2*n*t*b[2]+t*t*c[2]);
    };
    const widthAt=(t:number)=>Math.max(.012,Math.min(1,.48+t*3)*(1-t**2.4));
    cast(center,(_t,p)=>point(p.x/.25,(p.y-crownY)/.27,p.z/.20).normalize(),
      t=>w*widthAt(t),t=>.019*widthAt(t),11,shadeBias);
  }

  // Hairline rises over the forehead and drops down the nape. The crown spirals
  // from an off-centre part, with broad locks sculpted into the continuous shell.
  const panels=16;
  add(surface(13,panels*5,(t,u)=>{
    const a=u*TAU;
    const front=Math.max(0,Math.cos(a));
    const backLength=id==="rosette" || id==="bamboo" ? .41 : .20;
    const end=2.18-.99*front**1.4+.064*Math.sin(a*3+.3)
      +(1-front)*(.018+backLength*Math.max(0,-Math.cos(a))**.8+.044*Math.cos(a*11+.2));
    const phi=.014+(end-.014)*t;
    const flow=a+.24*(1-t)**1.4+.075*Math.sin(a*2+.6)*t;
    const comb=(.5+.5*Math.cos(a*panels))**.76;
    const relief=(.002+.010*comb)*Math.sin(phi);
    const r=Math.sin(phi);
    const x=part*.35*(1-r)**2+(.273+relief)*r*Math.sin(flow);
    const y=crownY+(radiusY+.5*relief)*Math.cos(phi);
    const c=Math.cos(flow);
    const z=-.007+(.236+relief)*r*Math.sign(c)*Math.abs(c)**.90;
    return [point(x,y,z),paint(.60+.29*comb-.19*t+.055*Math.cos(a*3),
      (.045+.11*comb)*Math.exp(-Math.pow((phi-.89)/.38,2)))];
  }),white);

  // The nape locks follow the scalp before falling free below the occiput.
  // Their outer ridges follow the same ellipsoid as the crown at every height.
  const longBack = id === "bamboo" || id === "rosette";
  const napeHeight = longBack ? .688 : id === "coral" ? .748 : .776;
  for(let j=0;j<9;j++){
    const origin=1.42+j*(TAU-2*1.42)/8;
    const end = napeHeight + .021 * Math.cos(j * 1.8);
    const sideDrift=.085*Math.sin(j*2.12+.8);
    add(surface(13,8,(t,u)=>{
      const y=1.124+(end-1.124)*t, side=2*u-1;
      const halfWidth=.276*Math.sin(Math.PI*(.004+.994*t))**.66;
      const a=origin+sideDrift*t+.096*Math.sin(t*Math.PI)+halfWidth*side;
      const c=Math.cos(a), headR=Math.sqrt(Math.max(.001,1-((y-crownY)/radiusY)**2));
      const drop=Math.max(0,(crownY-y)/(crownY-end));
      const r=Math.max(headR, y<crownY ? 1-.24*drop**1.62 : 0);
      const ridge=(1-side**2)*Math.sin(t*Math.PI)**.72;
      const lift=.013+.013*ridge+.008*t;
      const p=point((.273*r+lift)*Math.sin(a),y, -.007+(.236*r+lift)*Math.sign(c)*Math.abs(c)**.9);
      return [p,paint(.59+.24*ridge+.06*Math.cos(a*3)-.09*t,
        .09*ridge*Math.exp(-Math.pow((t-.31)/.2,2)))];
    }),white);
  }

  if(id==="nocturne" || id==="orbit"){
    const sign=id==="nocturne"?1:-1;
    // Graduated, overlapping triangles read like the player's swept boy cut.
    for(let j=0;j<6;j++){
      const endX=(-.224+j*.062)*sign, endY=.988+.071*(j/5)**1.4;
      bang([(.009+j*.024)*sign,1.18-.004*j,.014],[(j*.034-.09)*sign,1.144-j*.006,.024],
        [endX,endY+(j%2)*.020,.010],.054+(j%2)*.006,(j%3)*.033);
    }
    bang([.115*sign,1.166,.004],[.177*sign,1.099,.014],[.222*sign,.984,.009],.046,.025);
    for(const s of [-1,1]) {
      lock([[s*.188,1.098,.120],[s*.235,1.029,.098],[s*.245,.964,.087],[s*.235,.881,.077]],
        .041,.015,[s,.03,.51],.05);
      lock([[s*.202,1.100,-.076],[s*.249,1.018,-.083],[s*.272,.925,-.092],[s*.278,.895,-.132]],
        .048,.018,[s,.04,-.38],.02,8);
    }
  } else {
    const s = id === "coral" ? -1 : 1;
    const lift = id === "bamboo" ? .027 : 0;
    bang([.026*s,1.194,.006],[-.053*s,1.180,.018],[-.182*s,1.006+lift,.012],.060);
    bang([.063*s,1.183,.008],[-.005*s,1.113,.028],[-.111*s,1.004+lift,.014],.063,.05);
    bang([.069*s,1.175,.007],[.066*s,1.070,.018],[.005*s,1.023+lift,.013],.054,.025);
    bang([.083*s,1.174,.008],[.119*s,1.088,.022],[.202*s,.997+lift,.010],.062);
    for(const side of [-1,1]){
      lock([[side*.169,1.115,.139],[side*.219,1.032,.120],[side*.234,.933,.125],
        [side*.220,.864,.118],[side*.192,.819,.134]],.041,.017,[side*.69,.06,.82],.06);
    }
  }

  function leaf(base:V, tip:V, breadth:number, hex:number, forward:V=[0,.12,1]){
    const from=point(...base), delta=point(...tip).sub(from), normal=point(...forward).normalize();
    const across=delta.clone().cross(normal).normalize();
    const color=new THREE.Color(hex);
    add(surface(6,4,(t,u)=>{
      const arc=Math.sin(t*Math.PI), side=u*2-1;
      const p=from.clone().addScaledVector(delta,t).addScaledVector(across,arc*side*breadth);
      p.addScaledVector(normal,arc*(.005+.008*(1-Math.abs(side))));
      return [p,color.clone().multiplyScalar(.76+.23*(1-Math.abs(side))+.12*t)];
    }),white);
  }

  function rose(at:V,size:number,angle:number) {
    const origin=point(...at), face=point(Math.sin(angle),.32,Math.cos(angle)).normalize();
    const side=point(Math.cos(angle),0,-Math.sin(angle)), up=face.clone().cross(side).normalize();
    const layers=[{n:5,extent:1},{n:4,extent:.69},{n:3,extent:.38}];
    for(const [layer,{n,extent}] of layers.entries()) for(let j=0;j<n;j++){
      const centre=TAU*(j/n+layer*.094);
      add(surface(3,5,(t,u)=>{
        const edge=Math.sin(Math.PI*u), theta=centre+(u-.5)*1.55;
        const r=size*extent*(.20+t*(.50+.36*edge));
        const raised=size*(.14+layer*.17+.36*Math.sin(t*Math.PI)+t*.15*edge);
        const p=origin.clone().addScaledVector(side,Math.cos(theta)*r)
          .addScaledVector(up,Math.sin(theta)*r).addScaledVector(face,raised);
        return [p,new THREE.Color(0x913f67).lerp(new THREE.Color(0xffc5be),.19+.69*t+.09*edge)];
      }),white);
    }
  }

  switch(id) {
    case "rosette": {
      for(const side of [-1,1]){
        for(let j=0;j<2;j++){
          const center=(t:number)=>{
            const a=4.2*Math.PI*t+j*Math.PI+.6,rad=.043*(1-.69*t);
            return point(side*(.227+.070*Math.sin(t*Math.PI*.72)+rad*Math.cos(a)),
              1.055-.445*t,-.031+.052*t+rad*Math.sin(a));
          };
          const profile=(t:number)=>Math.max(.017,Math.sin(Math.PI*(.09+.90*t))**.62);
          cast(center,(t)=>point(side*Math.cos(4.2*Math.PI*t+j*Math.PI+.6),.15,Math.sin(4.2*Math.PI*t+j*Math.PI+.6)),
            t=>.054*profile(t),t=>.024*profile(t),18,j*.04);
        }
      }
      wire([[-.247,1.065,.094],[-.190,1.125,.139],[-.089,1.176,.108],
        [.006,1.198,.078],[.121,1.165,.102],[.219,1.098,.106]],.006,0xc69353,20);
      rose([-.208,1.112,.146],.056,-.54);rose([-.146,1.162,.130],.044,-.32);
      rose([.190,1.122,.143],.033,.50);
      leaf([-.219,1.115,.125],[-.270,1.173,.116],.015,0x74805a);
      leaf([-.155,1.158,.110],[-.165,1.223,.099],.015,0xabb17c);
      leaf([.180,1.131,.129],[.233,1.166,.110],.011,0xb39a61);
      break;
    }
    case "nocturne": {
      // A real crescent with tapered horns sits against the temple, with chased silver feather barbs.
      const origin=point(.213,1.106,.120), right=point(.87,.02,-.49), up=point(-.06,.99,-.03);
      add(surface(18,4,(t,u)=>{
        const a=-1.36+3.36*t,thickness=.021*Math.sin(t*Math.PI)**.8;
        const r=.056-thickness*u;
        const p=origin.clone().addScaledVector(right,Math.cos(a)*r).addScaledVector(up,Math.sin(a)*r);
        p.z+=.005*Math.sin(Math.PI*u);
        return [p,new THREE.Color(0x9faac5).lerp(new THREE.Color(0xffedbd),1-u*.65)];
      }),white);
      leaf([.238,1.115,.082],[.296,1.217,.015],.018,0xe3e6f2,[.47,.08,.9]);
      leaf([.246,1.106,.078],[.318,1.175,-.008],.014,0xa6b3db,[.48,.08,.9]);
      wire([[.246,1.111,.096],[.274,1.164,.064],[.294,1.204,.033]],.0027,0xe4c78c,8);
      bead(.237,1.080,.119,.012,.020,.009,0x8972a6);
      break;
    }
    case "coral": {
      for(const side of [-1,1]){
        const base=(t:number)=>.224+.084*Math.sin(Math.PI*(t*.82+.08));
        for(let j=0;j<3;j++){
          const phase=j*TAU/3, wiggle=(t:number)=>Math.sin(3.8*Math.PI*t+phase);
          const center=(t:number)=>point(side*(base(t)+.021*(1-.4*t)*wiggle(t)),1.012-.455*t,
            -.026+.086*t+.029*(1-.42*t)*Math.cos(3.8*Math.PI*t+phase));
          const width=(t:number)=>Math.max(.020,(1-.53*t)*Math.min(1,(1-t)*12));
          cast(center,()=>point(side*.33,.05,1),t=>.034*width(t),t=>.028*width(t),20,j*.078-.04);
        }
        const x=base(.951)*side;
        bead(x,.581,.060,.024,.016,.022,0xd4ab70);
        lock([[x,.579,.062],[x+side*.006,.555,.070],[x+side*.021,.521,.075],[x+side*.037,.505,.073]],
          .023,.011,[side*.4,0,1],.21,7);
      }
      // Fan ribs and scalloped nacre form a single shell above the braid.
      const origin=point(-.224,1.045,.122), across=point(.86,.08,.49), up=point(-.20,.97,-.07);
      add(surface(7,35,(t,u)=>{
        const a=(u-.5)*2.35, ridge=.5+.5*Math.cos(u*TAU*7);
        const r=t*(.086+.016*ridge),p=origin.clone().addScaledVector(across,Math.sin(a)*r).addScaledVector(up,Math.cos(a)*r);
        p.z+=.011*Math.sin(Math.PI*t)+.009*ridge*t;
        return [p,new THREE.Color(0xcfa2a8).lerp(new THREE.Color(0xffead0),.20+.5*ridge+.29*t)];
      }),white);
      for(let j=0;j<4;j++){
        const a=.62+j*.19;
        bead(-.230*Math.cos(a),1.071+.089*Math.sin(a),.17-j*.007,.008,.009,.008,0xffe8dd);
      }
      bead(-.224,1.050,.133,.014,.014,.011,0xfff1cf);
      break;
    }
    case "orbit": {
      lock([[-.079,1.177,-.048],[-.112,1.235,-.024],[-.161,1.229,.002],[-.185,1.203,.012]],
        .028,.014,[-.22,.88,.43],.12);
      const band = (t:number,u:number) => {
        const a=TAU*t, y=1.102+.027*Math.cos(a)+.035*(u-.5);
        const r=Math.sqrt(1-((y-crownY)/radiusY)**2);
        return point((.276*r+.022)*Math.sin(a),y,(.244*r+.030)*Math.cos(a)-.007);
      };
      add(surface(44,3,(t,u)=>[band(t,u),new THREE.Color(u<.15||u>.85?0xa4784f:0x745442)]),white);
      for(const s of [-1,1]){
        const at=point(s*.089,1.132,.209),normal=point(s*.29,.28,.914).normalize();
        const h=point(.953,0,-s*.30),v=normal.clone().cross(h).normalize();
        add(surface(6,24,(t,u)=>{
          const a=u*TAU, r=.002+t*.998;
          const p=at.clone().addScaledVector(h,.058*r*Math.cos(a)).addScaledVector(v,.043*r*Math.sin(a))
            .addScaledVector(normal,.020*(1-r*r));
          const light=.32+.35*Math.sin(a)*r+.23*(1-r);
          return [p,new THREE.Color(0x315572).lerp(new THREE.Color(0x97e1e1),light)];
        }),white);
        const ring:V[]=Array.from({length:21},(_,j)=>{
          const a=j*TAU/20;
          return at.clone().addScaledVector(h,.061*Math.cos(a)).addScaledVector(v,.046*Math.sin(a)).toArray() as V;
        });
        wire(ring,.0065,0xd6a76b,24);
        const gleam=(x:number,y:number)=>at.clone().addScaledVector(h,x).addScaledVector(v,y).addScaledVector(normal,.014).toArray() as V;
        wire([gleam(-.032,.008),gleam(-.020,.022),gleam(-.005,.027)],.0028,0xdaf2e9,6);
      }
      wire([[-.034,1.130,.227],[0,1.144,.233],[.034,1.130,.227]],.0072,0xb18553,8);
      break;
    }
    case "bamboo": {
      // Successive turns converge into a half-up chignon; the spindle is hidden inside the coil.
      add(surface(9,18,(t,u)=>{
        const a=TAU*u, v=Math.PI*t, r=Math.sin(v);
        return [point(.069*r*Math.cos(a),1.208+.059*Math.cos(v),-.137+.053*r*Math.sin(a)),
          paint(.46+.19*Math.cos(a*7)*r)];
      }),white);
      const center=(t:number)=>{
        const a=t*4.8*Math.PI+.32,r=.074*Math.sin(Math.PI*(.17+.73*t))**.72;
        return point(r*Math.cos(a),1.148+.124*t,-.137+r*.77*Math.sin(a));
      };
      cast(center,(t)=>point(Math.cos(t*4.8*Math.PI+.32),.4,Math.sin(t*4.8*Math.PI+.32)),
        t=>.031*(.75+.25*Math.sin(Math.PI*t)),t=>.024*(.9+.1*t),31,.06);
      for(const s of [-1,1]) {
        lock([[s*.205,1.061,-.091],[s*.201,1.084,-.155],[s*.145,1.142,-.184],[s*.053,1.171,-.152]],
          .056,.016,[s*.55,.4,-.82],.14);
        lock([[s*.143,.947,-.168],[s*.170,.816,-.159],[s*.177,.705,-.147],[s*.147,.595,-.171]],
          .068,.024,[s*.46,0,-1],-.04);
      }
      wire([[-.145,1.144,-.175],[.003,1.207,-.102],[.142,1.263,-.051]],.0063,0xd5b776,11);
      leaf([.117,1.252,-.048],[.188,1.281,-.035],.014,0x88b8a5);
      leaf([.121,1.252,-.046],[.149,1.310,-.064],.012,0xbcd3a4);
      wire([[.136,1.262,-.051],[.160,1.228,-.060],[.163,1.191,-.059]],.0026,0xc49d60,8);
      bead(.163,1.184,-.059,.010,.016,.010,0x9bcabb);
      break;
    }
  }
}
