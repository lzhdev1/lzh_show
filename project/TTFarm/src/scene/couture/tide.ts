import type { Atelier, Bind, Fabric, V } from "./atelier";

const tau = Math.PI * 2;
const sin = Math.sin, cos = Math.cos;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sample = (n: number, point: (t: number) => V): V[] =>
  Array.from({length:n+1}, (_,i) => point(i/n));
const circle = (n: number, point: (angle: number) => V): V[] =>
  Array.from({length:n}, (_,i) => point(tau*i/n));

type Cut = (angle: number, t: number) => V;
function garment(a: Atelier, cut: Cut, color: number, fabric: Fabric, bind: Bind, rows: number, n = 64, embroidery = true) {
  a.shell(Array.from({length:rows+1},(_,i) => circle(n,theta => cut(theta,i/rows))),
    color,fabric,bind,true,embroidery);
}

function silk(a: Atelier, path: V[], widths: number[], direction: [number,number],
  color: number, piping: number, bind: Bind, fabric: Fabric = "satin") {
  const rows = path.map(([x,y,z],i): V[] => {
    const dx = widths[i]*direction[0], dz = widths[i]*direction[1];
    return [[x-dx,y,z-dz],[x-.22*dz,y,z+.22*dx],[x+dx,y,z+dz]];
  });
  a.shell(rows,color,fabric,bind,false,false);
  a.tube(rows.map(row=>row[0]),.0024,piping,"metal",bind);
}

// Fitted blocks sampled on the bundled avatar. Front and back need different
// depths, particularly where a low neckline crosses the shoulder blades.
const block = [
  [.898,.147,.126,.123],[.954,.142,.125,.123],[1.023,.121,.119,.104],
  [1.074,.126,.121,.100],[1.141,.144,.134,.102],[1.187,.146,.123,.091],
  [1.220,.145,.103,.083],[1.249,.148,.078,.075],[1.275,.151,.056,.071],
  [1.289,.138,.047,.069],[1.306,.087,.034,.066]
];
function fit(theta: number, y: number, ease = 0): V {
  let i=0;
  while(i < block.length-2 && y > block[i+1][0]) i++;
  const lower=block[i], upper=block[i+1];
  const t=Math.min(1,Math.max(0,(y-lower[0])/(upper[0]-lower[0])));
  const depth=cos(theta)>0 ? 2 : 3;
  return [(mix(lower[1],upper[1],t)+ease)*sin(theta),y,(mix(lower[depth],upper[depth],t)+ease)*cos(theta)];
}
function neckline(a: Atelier, height: (theta: number) => number, color: number, trim: number) {
  const cut: Cut = (theta,t) => fit(theta,mix(.90,height(theta),t),.003);
  garment(a,cut,color,"satin","torso",12);
  a.tube(sample(72,t=>cut(t*tau,1)),.003,trim,"satin","torso");
}
function cuff(a: Atelier, side: number, x: number, r: number, color: number) {
  const cut: Cut = (theta,t) => [side*(x+t*.012),1.274+r*sin(theta),-.024+r*cos(theta)];
  garment(a,cut,color,"satin","arm",1,24);
}

// Moon-jelly dress. The organza bubble returns under itself over a dark
// fitted mini. A bias-cut yoke and long curling streamers continue around it.
function jelly(a: Atelier) {
  const ink=0x514b88, iris=0x9784d9, lagoon=0x92dce7, silver=0xe3dcf9;
  const neck=(theta:number)=>1.226+.045*sin(theta+.52)+.021*Math.abs(sin(theta));
  neckline(a,neck,ink,silver);
  const yoke=(theta:number,t:number)=>fit(theta,neck(theta)-.001-mix(.008,.053+.025*cos(theta-1.5),t),.011);
  garment(a,yoke,iris,"satin","torso",4);
  a.tube(sample(64,t=>yoke(t*tau,1)),.003,lagoon,"satin","torso");
  a.sleeves("puff",lagoon,iris,"tulle",1);
  a.shoes(ink,lagoon,"ribbon");
  a.skirt({hem:.634,width:.198,depth:.161,color:ink,pleats:5,wave:.005});
  const profiles = [[.964,.144,.125],[.924,.213,.161],[.856,.289,.218],
    [.785,.325,.25],[.725,.33,.254],[.681,.294,.223],[.696,.234,.191]];
  const bell=(theta:number,ring:number):V=>{
    const [y,w,d]=profiles[ring], progress=ring/6;
    const swell=progress*.013*cos(7*theta+.4);
    const lower=progress**2*(.023*cos(7*theta+.4)+.027*sin(theta+.54));
    return [(w+swell)*sin(theta),y+lower,(d+swell)*cos(theta)];
  };
  a.shell(profiles.map((_,i)=>circle(84,t=>bell(t,i))),lagoon,"tulle","skirt",true,false);
  a.shell([4,5,6].map(i=>circle(84,t=>bell(t,i))),iris,"tulle","skirt",true,false);
  a.tube(sample(84,t=>bell(t*tau,5)),.0035,silver,"satin","skirt");
  for(let i=0;i<7;i++) {
    const theta=tau*i/7;
    a.tube(profiles.map((_,j)=>bell(theta+j*.045,j)),.0026,silver,"lace","skirt");
  }
  // Pairs of crêpe and organza flounces curl back on opposite sides. The
  // broad ones are shorter at the front, sweeping down the back of the knees.
  for(const [angle,length,width,color] of [[1.50,.204,.030,iris],[2.07,.338,.041,lagoon],
    [3.63,.310,.042,iris],[4.27,.207,.032,lagoon],[5.64,.12,.021,iris]]) {
    const root=bell(angle,5);
    const path=sample(16,t=>{
      const twist=.054*sin(t*tau+.35)*t, rad=.032*sin(t*Math.PI);
      return [root[0]+rad*sin(angle)+twist*cos(angle), root[1]-length*t,
        root[2]+rad*cos(angle)-twist*sin(angle)-.063*t*t];
    });
    silk(a,path,path.map((_,i)=>width*(1-i/18)*(1+.25*sin(i*.75))),[cos(angle),-sin(angle)],
      color,silver,"skirt",color===lagoon?"tulle":"satin");
    a.pearl(path[16],[.006,.013,.006],silver,"metal","skirt");
  }
  a.ring([[.952,.15,.131],[.976,.144,.129]],iris,"satin","torso");
  const hood=[[1.556,.06,.056],[1.573,.066,.061],[1.601,.049,.05],[1.618,.007,.007]];
  a.shell(hood.map(([y,w,d])=>circle(32,t=>[.082+w*sin(t),y-.014*sin(t),-.032+d*cos(t)])),iris,"satin","head");
  for(let i=0;i<4;i++){
    const theta=.5+i*.61;
    const top:V=[.082+.063*sin(theta),1.548,-.032+.056*cos(theta)];
    const end:V=[top[0]+.009*sin(theta),1.505+.012*cos(2*theta),top[2]];
    a.tube([top,end],.002,silver,"metal","head"); a.pearl(end,[.006,.01,.006],lagoon,"satin","head");
  }
}

// Naval bolero, cut away at the front. Individual boxed knife pleats show
// contrasting inverted folds both from the front and behind the character.
function sail(a: Atelier) {
  const midnight=0x29476b, blue=0x689fc2, cream=0xf6efdb, brass=0xd6ac66, coral=0xd9786d;
  a.bodice(cream,cream,"square");
  a.sleeves("cap",midnight,cream);
  a.shoes(midnight,brass,"boot");
  const skirt=(theta:number,t:number):V=>{
    const biased=.026*sin(theta+.48);
    return [(mix(.143,.268,t))*sin(theta),mix(.972,.641+biased,t),(.003+mix(.122,.206,t)*cos(theta))];
  };
  a.skirt({hem:.665,width:.245,depth:.181,pleats:12,wave:.006,color:midnight});
  // Folded faces overlap the recessed navy lining; alternating return faces
  // are visible in profile rather than simply tinting a sinusoidal skirt.
  for(let k=0;k<14;k++){
    const axis=k*tau/14, step=tau/14;
    const face=(u:number,t:number):V=>{
      const angle=axis+step*(u-.50)+.13*t;
      const p=skirt(angle,t), edge=1-Math.abs(2*u-1);
      const f=t*(.009+.021*edge);
      return [p[0]+f*sin(angle),p[1]+.007*t*u,p[2]+f*cos(angle)];
    };
    const grid=[0,.35,.7,1].map(t=>[face(.03,t),face(.22,t),face(.95,t)]);
    a.shell(grid,k===2||k===9?cream:blue,"satin","skirt",false,false);
    a.tube(grid[3],.0035,cream,"satin","skirt");
    const fold=grid.map((row,i):V[]=>{
      const point=row[0], far=face(-.13,i/3);
      return [point,[far[0]*.97,far[1]+.006,far[2]*.97]];
    });
    a.shell(fold,midnight,"satin","skirt",false,false);
  }
  a.ring([[.936,.155,.138],[.985,.145,.129]],midnight,"satin","torso");
  a.gem([0,.959,.133],[.019,.014,.005],brass,"metal","torso");
  const jacket=(u:number,t:number):V=>{
    const gap=mix(.11,.58,t), angle=gap+u*(tau-2*gap);
    const hem=1.018-.033*Math.max(0,cos(angle))+.017*cos(2*angle);
    const high=1.255+.035*Math.abs(sin(angle))+.025*(1-cos(angle))*.5;
    return fit(angle,mix(hem,high,t),.017+.005*(1-t));
  };
  const body=[0,.16,.44,.72,1].map(t=>sample(54,u=>jacket(u,t)));
  a.shell(body,midnight,"satin","torso",false,false);
  a.tube(body[0],.0035,brass,"metal","torso");
  for(const s of [-1,1]){
    a.tube(sample(10,u=>jacket(s===1?0:1,u)),.004,cream,"satin","torso");
    const lapel:V[][]=[
      [[s*.032,1.114,.143],[s*.064,1.128,.147]],
      [[s*.050,1.177,.14],[s*.112,1.202,.103]],
      [[s*.078,1.252,.09],[s*.137,1.248,.077]],
      [[s*.079,1.297,.01],[s*.14,1.281,.009]]];
    a.shell(lapel,blue,"satin","torso",false,false);
    a.tube(lapel.map(row=>row[1]),.004,cream,"satin","torso");
    for(let k=0;k<3;k++)a.pearl(fit(s*.43,1.045+k*.041,.029),[.007,.007,.004],brass,"metal","torso");
    cuff(a,s,.201,.063,cream);
  }
  const back:V[][]=[
    [[-.145,1.183,-.075],[0,1.112,-.133],[.145,1.183,-.075]],
    [[-.15,1.22,-.071],[0,1.17,-.123],[.15,1.22,-.071]],
    [[-.136,1.288,-.045],[0,1.292,-.10],[.136,1.288,-.045]]];
  a.shell(back,blue,"satin","torso",false,false);
  a.tube(back[0],.008,cream,"satin","torso");
  a.tube(back[0].map(([x,y,z]):V=>[x*.97,y+.022,z-.004]),.003,cream,"satin","torso");
  silk(a,[[0,1.252,.084],[.003,1.217,.121],[.018,1.145,.153]],[.017,.014,.004],
    [1,0],coral,brass,"torso");
  const cap=(rows:number[][],color:number)=>a.shell(rows.map(([y,w,d])=>
    circle(36,t=>[-.027+w*sin(t),y-.022*sin(t),-.025+d*cos(t)])),color,"satin","head");
  cap([[1.553,.111,.119],[1.579,.12,.126],[1.606,.132,.135],[1.625,.078,.09],[1.63,.003,.003]],cream);
  cap([[1.549,.114,.122],[1.568,.12,.128]],midnight);
  const visor=[.03,.55,1].map(t=>sample(20,u=>{
    const theta=(u-.5)*2.18;
    return [-.027+(.107+.016*t)*sin(theta),1.556-.018*t*cos(theta)-.020*sin(theta),
      -.025+(.113+.05*t)*cos(theta)];
  }));
  a.shell(visor,midnight,"satin","head",false,false);
  a.gem([-.026,1.582,.106],[.013,.016,.004],brass,"metal","head");
}

// Bias-cut trumpet gown. The two contrasting gores spiral down one continuous
// satin column, flaring at the knee and opening into a train behind the feet.
function opera(a: Atelier) {
  const pearl=0xf2e3d6, oyster=0xc3a6b4, mauve=0x936e89, gold=0xd8b789;
  const neck=(theta:number)=>1.18+.091*Math.abs(sin(theta))**1.5+.020*Math.max(0,cos(theta));
  neckline(a,neck,pearl,gold);
  a.sleeves("glove",oyster,pearl,"satin");
  a.shoes(mauve,gold,"pump"); a.liningColor=oyster;
  const profile=[[.967,.146,.129],[.898,.163,.142],[.823,.184,.151],[.734,.19,.154],
    [.607,.183,.145],[.516,.194,.151],[.435,.238,.193],[.345,.296,.243],[.29,.324,.264]];
  const train=(theta:number,p:number,lift=0):V=>{
    const q=Math.min(7.999,p*8), i=Math.floor(q), u=q-i, row=profile[i], next=profile[i+1];
    const tail=Math.max(0,(p-.59)/.41), rear=(1-cos(theta))*.5;
    const flute=.024*tail*(.5+.5*cos(theta*9+p*1.7));
    return [(mix(row[1],next[1],u)+flute+lift)*sin(theta),
      mix(row[0],next[0],u)-tail*(.115*rear**2+.019*cos(theta*9+p*1.7)),
      (mix(row[2],next[2],u)+flute+lift)*cos(theta)-tail*.062*rear**2];
  };
  // These four gores form a single closed garment. Adjacent pattern pieces
  // use identical seam samples, so a bent knee cannot lift the darker lining
  // through a coplanar decorative panel.
  const seams=(t:number)=>{
    const front=-.78+1.6*t+.13*cos(4*t), back=2.35+1.52*t+.13*cos(4*t);
    const bias=.19+.79*Math.sin(t*Math.PI*.53)**1.2;
    const frontWidth=bias+.51*t*t, backWidth=bias+.35*t*t;
    return [front-frontWidth,front+frontWidth,back-backWidth,back+backWidth,front-frontWidth+tau];
  };
  const gores=[pearl,oyster,mauve,oyster];
  for(const [idx,color] of gores.entries()) {
    const rows=Array.from({length:25},(_,i)=>{
      const t=i/24, seam=seams(t);
      return sample(28,u=>train(mix(seam[idx],seam[idx+1],u),t));
    });
    a.shell(rows,color,"satin","skirt",false,false);
    if(idx%2===0)a.tube(rows.map(row=>row[0]),.0028,gold,"metal","skirt");
  }
  a.tube(sample(81,t=>train(t*tau,1,.004)),.0035,pearl,"satin","skirt");
  // Projecting folds of the cowl are cut fuller at centre front.
  const cowl=(u:number,t:number):V=>{
    const angle=(u-.5)*2.60,bias=Math.max(0,cos(angle));
    const y=neck(angle)-.003-(.011+.070*bias**2)*t;
    const p=fit(angle,y,.009+.014*sin(t*Math.PI)*bias);
    return [p[0],p[1],p[2]+.008*bias*sin(t*Math.PI)];
  };
  a.shell([0,.25,.53,.8,1].map(t=>sample(36,u=>cowl(u,t))),pearl,"satin","torso",false,false);
  a.tube(sample(36,u=>cowl(u,1)),.0025,gold,"metal","torso");
  for(let layer=0;layer<2;layer++){
    const chain=(u:number):V=>{
      const theta=1.92+u*(tau-3.84), drop=sin(Math.PI*u);
      return fit(theta,1.25-(.102+layer*.041)*drop,.007+.010*drop);
    };
    a.tube(sample(24,chain),.0019,gold,"metal","torso");
    for(let i=1;i<15;i++){
      const r=.004+.0028*sin(i*Math.PI/15);
      a.pearl(chain(i/15),[r,r,r],pearl,"satin","torso");
    }
  }
  const back=fit(Math.PI,1.108,.017);
  a.gem([back[0],back[1]-.016,back[2]],[.009,.024,.007],pearl,"metal","torso");
  // Mother-of-pearl comb, formed from a fan of narrow ribbed shell blades.
  const origin:V=[-.089,1.55,.016];
  for(let i=0;i<6;i++){
    const angle=-1.23+.34*i, sz=.048+.016*sin(i*Math.PI/5);
    const tip:V=[origin[0]+sz*sin(angle),origin[1]+sz*cos(angle),origin[2]+.003*i];
    silk(a,[origin,[(origin[0]+tip[0])/2,(origin[1]+tip[1])/2,tip[2]],tip],
      [.001,.010,.001],[1,0],i%2?oyster:pearl,gold,"head");
  }
  a.pearl(origin,[.013,.013,.009],pearl,"satin","head");
}

// Asymmetric surf dress. The same curved pattern pieces cross the bust, run
// into the wrap, and reappear on the rear panel as a large graphic wave.
function ripple(a: Atelier) {
  const deep=0x267978, jade=0x64bda9, mint=0xc1e5c6, opal=0xf2dec0;
  const neck=(t:number)=>1.222+.064*sin(t+.1)+.012*cos(t);
  neckline(a,neck,deep,mint);
  a.shoes(deep,opal,"slipper");
  const field=(theta:number,t:number):V=>fit(theta,mix(.902,neck(theta),t),.007);
  const waveTop=(t:number)=>.55-.92*t+.40*sin(t*tau-.42);
  for(const side of [0,Math.PI]){
    const stripe=(u:number,t:number)=>field(side+waveTop(t)+(u-.5)*(1.43+.38*sin(t*Math.PI)),t);
    a.shell(Array.from({length:15},(_,i)=>sample(19,u=>stripe(u,i/14))),mint,"satin","torso",false,false);
  }
  a.skirt({hem:.661,width:.215,depth:.172,slant:.043,pleats:5,wave:.005,color:deep});
  const wrap=(u:number,t:number,offset=0):V=>{
    const theta=-1.20+u*5.99-.24*t, swell=sin(t*Math.PI*.50);
    const hem=.594+.169*(1-u)**5+.037*sin(theta-.25)-.066*((1-cos(theta))*.5);
    return [(.153+.104*swell+offset)*sin(theta),mix(.953,hem,t),(.134+.068*swell+offset)*cos(theta)];
  };
  a.shell(Array.from({length:11},(_,i)=>sample(66,u=>wrap(u,i/10))),jade,"satin","skirt",false,false);
  // Two differently curved boundaries make a wide crest, not a stripe of even width.
  for(const [start,end] of [[.12,.46],[.58,.95]]){
    const cut=(u:number,t:number):V=>{
      const bend=.068*sin(t*5-.4)+.043*t;
      return wrap(mix(start+bend,end+bend-.084*sin(t*Math.PI),u),t,.006);
    };
    const rows=Array.from({length:16},(_,i)=>sample(20,u=>cut(u,i/15)));
    a.shell(rows,mint,"satin","skirt",false,false);
    a.tube(rows.map(row=>row[row.length-1]),.003,opal,"satin","skirt");
  }
  a.tube(sample(66,u=>wrap(u,1,.003)),.0035,deep,"satin","skirt");
  for(const [drift,length,width,color] of [[.032,.335,.052,deep],[-.018,.457,.058,mint]]){
    const line=sample(14,t=>[-.149-.128*sin(t*Math.PI*.70)+drift*t,.937-length*t,
      -.035-.172*t-.060*sin(t*Math.PI)]);
    silk(a,line,line.map((_,i)=>width*(.31+.69*sin(i*Math.PI/16))),
      [.78,.63],color,opal,"skirt");
  }
  a.gem([-.154,.936,-.024],[.018,.02,.014],opal,"metal","skirt");
  // One shoulder continues into a sculpted folded cuff that is empty on the opposite arm.
  a.sleeves("ribbon",mint,deep,"satin",1);
  for(let i=0;i<3;i++){
    const base:V=[-.094,1.537,-.016+i*.017], tip:V=[-.118+i*.012,1.59+i*.008,-.057+i*.018];
    silk(a,[base,[base[0]-.019,base[1]+.025,base[2]-.012],tip],[.002,.013,.001],
      [1,0],i===1?deep:mint,opal,"head");
  }
}

// Tailored ice cape with a wide architectural shoulder, a cutaway front,
// contrasting lining and an elongated folded diamond down the back.
function glacier(a: Atelier) {
  const indigo=0x485887, cornflower=0x859ac9, glacier=0xbddded, frost=0xf0ecf8;
  a.bodice(indigo,frost,"jewel");
  a.sleeves("glove",cornflower,frost);
  a.shoes(indigo,glacier,"boot");
  a.skirt({hem:.613,width:.203,depth:.168,pleats:6,slant:.025,color:indigo});
  const panels=(s:number,u:number,t:number,lift=0):V=>{
    const theta=s*mix(.22+.13*t,Math.PI-.009,u);
    const hem=.656+.091*cos(theta+.6)-.058*sin(2*theta);
    return [(mix(.147,.244,t)+lift)*sin(theta),mix(.957,hem,t),
      (mix(.128,.19,t)+lift)*cos(theta)];
  };
  for(const s of [-1,1]){
    a.shell([0,.36,.73,1].map(t=>sample(33,u=>panels(s,u,t))),s===1?cornflower:glacier,"satin","skirt",false,false);
    a.tube(sample(29,u=>panels(s,u,1,.002)),.0028,frost,"satin","skirt");
  }
  const cape=(theta:number,t:number,lining=0):V=>{
    const rear=(1-cos(theta))*.5, wing=Math.abs(sin(theta))**3;
    const shoulder=Math.sin(Math.min(1,t/.48)*Math.PI*.5);
    const fold=Math.sin(t*Math.PI)*.014*cos(4*theta);
    const radiusX=.082+.127*shoulder+Math.max(0,t-.48)*.09 + .022*wing*shoulder+lining;
    const radiusZ=.083+.081*shoulder+rear*.036*t+lining;
    const hem=1.173+.06*wing-.202*rear**2-.045*Math.max(0,cos(4*theta+.13))*rear;
    const shoulderY=1.307+.023*wing-.016*rear;
    return [(radiusX+fold)*sin(theta),mix(shoulderY,hem,t**1.7),-.012+(radiusZ+fold)*cos(theta)];
  };
  for(const side of [-1,1]){
    const face=(u:number,t:number,inside=0):V=>cape(side*(.39+u*(Math.PI-.39)),t,inside);
    const rows=Array.from({length:10},(_,i)=>sample(38,u=>face(u,i/9)));
    a.shell(rows,side>0?glacier:0xaac9e3,"satin","torso",false,false);
    a.shell([.86,1].map(t=>sample(38,u=>face(u,t,-.004))),cornflower,"satin","torso",false,false);
    a.tube(rows[9],.0032,frost,"metal","torso");
    // The exposed seam outlines a large folded lapel at the shoulder.
    const lapel=(u:number,t:number):V=>{
      const angle=mix(.40+1.48*(1-t),.43+.51*(1-t),u);
      return cape(side*angle,t,.006+.013*(1-Math.abs(2*u-1))*sin(t*Math.PI));
    };
    a.shell([0,.25,.50,.75,1].map(t=>sample(12,u=>lapel(u,t))),side>0?frost:cornflower,"satin","torso",false,false);
    a.tube(sample(14,t=>lapel(.02,t)),.0031,frost,"metal","torso");
    const inset=(u:number,t:number):V=>cape(side*(Math.PI-u*.66*(1-.24*t)*sin(t*Math.PI)),.13+.85*t,.006);
    a.shell([0,.2,.45,.7,1].map(t=>sample(12,u=>inset(u,t))),cornflower,"satin","torso",false,false);
  }
  a.ring([[1.276,.081,.086,-.013],[1.312,.063,.073,-.014]],frost,"satin","torso");
  a.gem([0,1.266,.103],[.015,.029,.009],glacier,"metal","torso");
  const comb=(t:number):V=>[-.11*cos(t*1.84),1.548+.035*sin(t*1.84),-.01+.095*sin(t*1.84)];
  a.tube(sample(18,comb),.004,frost,"metal","head");
  for(let i=0;i<5;i++){
    const base=comb(i*.155),h=.047-.006*i;
    const tip:V=[base[0]-.014,base[1]+h,base[2]-.015];
    silk(a,[base,[base[0]-.006,base[1]+h*.42,base[2]-.006],tip],[.004,.011,.001],
      [.63,.77],i%2?cornflower:glacier,frost,"head");
  }
}

export function buildTide(a: Atelier, id: string): void {
  switch(id) {
    case "tide-jelly": return jelly(a);
    case "azure-sail": return sail(a);
    case "pearl-opera": return opera(a);
    case "mint-ripple": return ripple(a);
    case "glacier-lace": return glacier(a);
  }
}
