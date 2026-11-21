import type { Spirit } from "../../game/weather";
import { brocadeUV } from "./brocade";
import type { DollAdd, V } from "./geometry";
import { brushes, compass, shellFan, sword } from "./keepsakes";
import { tailor, TAU, type Seam, type Tailor } from "./tailoring";

const cream=0xffeccb, gilt=0xe8bb77, rose=0xc96b90, jade=0x70a995;
const wardrobe:Record<Spirit,{skin:number,coat:number,leg:number,shoe:number,trim:number,wrists:[V,V]}> = {
  rosette:{skin:0xffdac7,coat:0xeea3b5,leg:0xffe4d9,shoe:0xb95d7d,trim:0xf6dfa4,wrists:[[-.234,.492,.064],[.203,.537,.118]]},
  nocturne:{skin:0xf6d0b8,coat:0x414569,leg:0x383951,shoe:0x363448,trim:0xd0dbe6,wrists:[[-.183,.408,.041],[.223,.396,.110]]},
  coral:{skin:0xffe0cd,coat:0x87cbcb,leg:0xf8eee3,shoe:0xb96168,trim:0xf7d6a1,wrists:[[-.226,.437,.069],[.223,.488,.126]]},
  orbit:{skin:0xf0c2a9,coat:0xac704f,leg:0x485465,shoe:0x654838,trim:0xffce81,wrists:[[-.204,.433,.078],[.211,.515,.152]]},
  bamboo:{skin:0xf6d5bb,coat:0x91baa7,leg:0xa3beb0,shoe:0x455d57,trim:0xe4d8a9,wrists:[[-.211,.47,.108],[.218,.491,.119]]},
};

function legs(t:Tailor,id:Spirit) {
  const w=wardrobe[id], lady=id==="rosette"||id==="coral";
  for(const side of [-1,1]){
    const x=side*(lady?.071:.082), z=side>0?.018:-.006, ankle=x+side*.014;
    t.shaped([[x,.39,0,.053,.055],[x,.314,.008,.053,.049],[x+side*.006,.218,z+.01,lady?.034:.047],
      [ankle,.157,z,.036,.037],[ankle,.089,z,.027]],w.leg,12);
    const tall=id==="orbit"||id==="nocturne";
    const outline:Seam[]=[[tall?.181:.095,tall?.043:.036,.037,ankle,z],[tall?.152:.085,.040,.042,ankle,z],
      [.075,.039,.046,ankle,z+.007],[.064,.044,.061,ankle,z+.017],[.051,.048,.075,ankle,z+.030],
      [.041,.049,.080,ankle,z+.034],[.030,.048,.081,ankle,z+.035]];
    t.shell(outline,w.shoe,14);
    t.shell([[.033,.049,.08,ankle,z+.034],[.024,.048,.080,ankle,z+.035],
      [.019,.042,.074,ankle,z+.035],[.018,.002,.002,ankle,z+.035]],tall?0x4b3e3b:0xd8b78f,14);
    if(tall){
      t.shell([[.184,.044,.039,ankle,z],[.174,.044,.040,ankle,z]],id==="orbit"?0xb58d64:0x9895b0,14);
      t.stitch([[ankle-.028,.127,z+.038],[ankle+.022,.107,z+.047],[ankle-.022,.093,z+.049],[ankle+.021,.078,z+.056]],.004,w.trim,5);
      t.stitch([[ankle+.028,.127,z+.038],[ankle-.022,.107,z+.047],[ankle+.022,.093,z+.049],[ankle-.021,.078,z+.056]],.0035,w.trim,5);
    }else{
      t.stitch([[ankle-.031,.075,z+.030],[ankle,.073,z+.054],[ankle+.03,.066,z+.061]],.0045,w.trim,3);
      if(id==="rosette") {
        t.stitch([[ankle-.027,.101,z+.014],[ankle,.124,z+.032],[ankle+.026,.146,z+.015]],.004,rose,3);
        t.stitch([[ankle+.028,.101,z+.014],[ankle,.124,z+.034],[ankle-.027,.146,z+.015]],.004,rose,3);
      }
    }
  }
}

function sleeves(t:Tailor,id:Spirit) {
  const w=wardrobe[id], wide=id==="bamboo"||id==="coral", velvet=id==="rosette";
  for(const s of [-1,1]){
    const [x,y,z]=w.wrists[s>0?1:0], elbow:V=[s*.196,y>.50?.514:.511,z*.23];
    const end:V=[x+(elbow[0]-x)*.13,y+(elbow[1]-y)*.13,z+(elbow[2]-z)*.13];
    const shoulder:V=[s*.098,.634,-.003];
    if(velvet){
      t.shaped([[...shoulder,.016],[s*.120,.636,-.001,.035],[s*.138,.632,.001,.045],
        [s*.154,.619,.002,.053],[s*.167,.601,.005,.057],[s*.174,.584,.009,.050],[s*.180,.563,.013,.034]],0xf7ced1,16,.027);
      t.shaped([[s*.177,.570,.014,.030],[...elbow,.028],[...end,.020]],w.skin,10);
      t.shaped([[s*.179,.557,.015,.034],[s*.181,.55,.017,.032]],gilt,12);
      t.shaped([[x*.98,y+.006,z-.01,.023],[x,y,z,.022]],0xf6d7c6,10);
    }else{
      const mid:V=[s*.163,.591,0], cuffRadius=wide?.063:.030;
      const cloth=t.shaped([[...shoulder,.014],[s*.115,.635,-.001,.032],[s*.133,.628,.001,.043],
        [s*.147,.615,.002,wide?.050:.046],[...mid,wide?.058:.051],[...elbow,wide?.067:.044],[...end,cuffRadius]],w.coat,16,wide?.038:.012);
      const edge=cloth[cloth.length-1], center=end;
      const inside=edge.map((p):V=>[center[0]+(p[0]-center[0])*.53,center[1]+(p[1]-center[1])*.53,center[2]+(p[2]-center[2])*.53]);
      t.satin([edge,inside],id==="coral"?0xffc1a9:id==="bamboo"?0xebead2:w.trim);
      t.stitch(edge,.0038,w.trim,14);
      if(id==="nocturne"){
        // The vambrace shares its sleeve's bent cross-sections, so the
        // metal edge stays seated when the sword hand turns forwards.
        const guard=cloth.slice(Math.floor((cloth.length-1)*.63)).map(row=>{
          const centre:V=[0,0,0],count=row.length-1;
          row.slice(0,count).forEach(p=>{centre[0]+=p[0]/count;centre[1]+=p[1]/count;centre[2]+=p[2]/count;});
          return row.map((p):V=>[centre[0]+(p[0]-centre[0])*1.07,centre[1]+(p[1]-centre[1])*1.07,centre[2]+(p[2]-centre[2])*1.07]);
        });
        t.satin(guard,0x777e99);t.stitch(guard[0],.003,0xd0c6bd,12);
      }
    }
    const hand=id==="orbit"?0x604438:w.skin;
    // The palm tips forward while the four fingers curl toward the keepsake.
    const palm:V=[x+s*.005,y-.019,z+.008];
    t.shaped([[...end,.019,.018],[x,y,z,.022,.018],[...palm,.026,.018],[x+s*.005,y-.030,z+.012,.017,.013]],hand,10);
    for(let i=0;i<4;i++) {
      const f=(i-1.5)*.009, length=[.021,.025,.023,.016][i];
      t.shaped([[palm[0]+f,palm[1]-.003,palm[2]+.005,.0067],
        [palm[0]+f+s*.002,palm[1]-length*.68,palm[2]+.011,.006],
        [palm[0]+f-s*.002,palm[1]-length+.002,palm[2]+.016,.004],
        [palm[0]+f-s*.002,palm[1]-length,palm[2]+.017,.002]],hand,7);
    }
    t.shaped([[x-s*.016,y-.010,z+.010,.009],[x-s*.023,y-.020,z+.024,.007],[x-s*.018,y-.029,z+.030,.003]],hand,7);
  }
}

const bodice:Seam[]=[[.683,.055,.050,0,.008],[.676,.073,.056,0,.006],[.670,.093,.061],
  [.660,.115,.066],[.648,.137,.069],[.634,.151,.073],[.618,.154,.076],[.600,.148,.079],
  [.564,.141,.084],[.525,.124,.082],[.489,.113,.077],[.466,.109,.072],[.437,.116,.080]];

// Sample the bust at the stitch, including both edges of a wide placket.
// The front of a curved garment is deeper at its centre than at its sides.
function onBodice([x,y,z]:V, allowance:number):V {
  if(y<.475||y>bodice[0][0])return [x,y,z];
  const i=bodice.findIndex(row=>row[0]<=y), low=bodice[i],high=bodice[Math.max(0,i-1)];
  const mix=high===low?0:(y-low[0])/(high[0]-low[0]);
  const w=low[1]+(high[1]-low[1])*mix,d=low[2]+(high[2]-low[2])*mix;
  const center=(low[4]??0)*(1-mix)+(high[4]??0)*mix;
  const surface=center+d*Math.sqrt(Math.max(0,1-(x/w)**2));
  return [x,y,Math.max(z,surface)+allowance];
}

function ribbon(t:Tailor, path:Array<[x:number,y:number,z:number,halfWidth:number]>,color:number,edge?:number,relief=.004) {
  const rows:V[][]=[];
  path.forEach(([x,y,z,w],i)=>{
    const [nx,ny,nz,nw]=path[i+1]??path[i];
    const steps=Math.max(1,Math.ceil(Math.abs(ny-y)/.024));
    for(let j=0;j<steps;j++){
      const q=j/steps,cx=x+(nx-x)*q,cy=y+(ny-y)*q,cz=z+(nz-z)*q,width=w+(nw-w)*q;
      rows.push([-1,-.5,0,.5,1].map(k=>onBodice([cx+k*width,cy,cz+(1-k*k)*.002],relief)));
    }
  });
  t.satin(rows,color);
  if(edge)t.stitch(rows.map(row=>row[0]),.0027,edge);
}

function tunic(t:Tailor,color:number,hem:number,hemWidth:number,hemDepth:number,sweetheart=false) {
  const rows=t.cut([...bodice,[hem,hemWidth,hemDepth]],32);
  for(const row of rows)row.forEach((p,i)=>{
    const a=TAU*i/(row.length-1)-Math.PI;
    const gathering=Math.exp(-(((p[1]-.478)/.050)**2))*.004;
    const fold=gathering*Math.cos(9*a+.8);
    p[0]+=fold*Math.sin(a);p[2]+=fold*Math.cos(a);
  });
  if(sweetheart){
    const edge=rows[6];
    for(const p of edge)p[1]-=.016*Math.max(0,p[2]/.076)**2;
    t.satin(rows.slice(0,7),wardrobe.rosette.skin);
    t.stitch(edge,.0045,0xffd5a9,32);
  }
  t.satin(sweetheart?rows.slice(6):rows,color,undefined,([x,y],u)=>{
    const armShadow=Math.exp(-(((Math.abs(x)-.126)/.034)**2+((y-.580)/.066)**2));
    const creases=Math.exp(-(((y-.477)/.060)**2))*(.5+.5*Math.cos(9*TAU*u+1));
    return 1.02-.15*armShadow-.085*creases;
  });
}
function cinch(t:Tailor,color:number,edge:number) {
  t.shell([[.477,.112,.079],[.466,.113,.081],[.435,.120,.084],[.426,.123,.085]],color,24);
  t.shell([[.436,.121,.086],[.429,.124,.087]],edge,24);
}
function collar(t:Tailor,color:number,trim:number,lapel=false){
  for(const s of [-1,1]) {
    const rows:V[][]=[
      [[s*.039,.673,.035],[s*.071,.656,.043],[s*.115,.642,.045]],
      [[s*.026,.645,.065],[s*.058,.628,.075],[s*.094,.612,.069]],
      lapel?[[s*.009,.550,.091],[s*.043,.581,.087],[s*.055,.586,.084]]:
        [[s*.006,.615,.077],[s*.028,.611,.078],[s*.048,.605,.077]],
    ];
    const curved:V[][]=[];
    rows.forEach((row,i)=>{
      const next=rows[i+1]??row, steps=i+1===rows.length?1:4;
      for(let j=0;j<steps;j++){
        const r=j/steps;
        const line=row.map((p,c):V=>[p[0]+(next[c][0]-p[0])*r,p[1]+(next[c][1]-p[1])*r,p[2]+(next[c][2]-p[2])*r]);
        curved.push(line.map(p=>onBodice(p,.010)));
      }
    });
    t.satin(curved,color);t.stitch(curved.map(row=>row[2]),.003,trim,7);
  }
}

function rosette(t:Tailor) {
  tunic(t,0xa9567e,.376,.146,.099,true);
  const skirt=t.cut([[.451,.11,.081],[.414,.145,.112],[.342,.204,.166],[.268,.248,.195],[.214,.249,.186]],
    40,-Math.PI,Math.PI,8,.009,.008);
  t.satin(skirt,0xffffff,brocadeUV);
  t.shell([[.231,.246,.181],[.214,.247,.183],[.199,.233,.174],[.196,.157,.116]],0xe5a1ac,28);
  // Each pointed overpetal follows the rounded underskirt and cups at its tip.
  for(let i=0;i<8;i++){
    const a=i*TAU/8, petals:V[][]=[
      [.443,.119,.087,.37,.004],[.391,.180,.139,.42,.009],[.336,.219,.176,.35,.011],[.292,.239,.194,.22,.013],
      [.268,.247,.197,.025,.016],
    ].map(([y,rx,rz,w,curve],j)=>[-1,-.5,0,.5,1].map((v):V=>[
      (rx+curve*(1-v*v))*Math.sin(a+v*w),y+(j>2?.016*v*v:0),(rz+curve*(1-v*v))*Math.cos(a+v*w)]));
    t.satin(petals,i%2?0xf3b8c3:0xd981a2);
    t.stitch(petals.map(r=>r[0]),.0023,0xffdbb7,4);
  }
  cinch(t,0xba6a87,gilt);
  const necklace:V[]=[[-.051,.675,.039],[-.037,.659,.056],[0,.643,.068],[.035,.660,.059],[.051,.675,.039]];
  t.stitch(necklace.map(p=>onBodice(p,.004)),.0025,gilt,8);
  t.gem(onBodice([0,.636,.073],.006),[.008,.012,.004],0xc980a0);
  for(const s of [-1,1]){
    t.stitch([[s*.091,.614,.077],[s*.068,.571,.084],[s*.055,.510,.080],[s*.060,.469,.070]],.0036,0xe9bca4,5);
    t.stitch([[s*.032,.596,.086],[-s*.026,.57,.092],[s*.025,.545,.093],[-s*.024,.519,.088],[s*.02,.494,.084]],.0028,0xffdcad,4);
  }
  t.bow([-.087,.449,.072],.067,0x9d506e,gilt);
  t.bow([0,.450,-.081],.121,0xe996b0,cream);
  t.bead([0,.604,.083],[.010,.012,.006],0xca7e9e);
  // A flower held against the bodice has a spiralling rose centre.
  const cx=.203,cy=.519,cz=.148;
  for(let layer=0;layer<2;layer++)for(let i=0;i<5;i++){
    const a=i*TAU/5+layer*.57, size=1-layer*.43;
    const petal:V[][]=[[.003,.003,.0],[.015,.017,.005],[.025,.021,.012],[.032,.014,.016]].map(([rad,w,depth],j)=>
      [-1,-.5,0,.5,1].map((v):V=>{
        const d=(rad-(j===3?.005*v*v:0))*size, across=v*w*size;
        return [cx+Math.sin(a)*d+Math.cos(a)*across,cy+Math.cos(a)*d-Math.sin(a)*across,cz+layer*.012+depth*size+.004*(1-v*v)];
      }));
    t.satin(petal,(layer?0xec9dae:i%2?0xc76683:0xd78398));
  }
  t.bead([cx,cy,cz+.026],[.008,.007,.006],0xefacae);
  t.stitch([[cx-.028,cy-.030,cz-.018],[cx-.011,cy-.021,cz-.01],[cx,cy,cz]],.003,0x7c9c77,2);
}

function nocturne(t:Tailor) {
  tunic(t,0x3e4666,.322,.169,.106);
  const coat=t.cut([[.454,.117,.081],[.395,.149,.098],[.314,.18,.112],[.276,.178,.112]],24,-Math.PI,Math.PI,6,.006,.014);
  t.satin(coat,0xffffff,brocadeUV);
  const cape=t.cut([[.661,.073,.058],[.61,.17,.094],[.54,.185,.115],[.38,.212,.137],[.23,.228,.151]],24,.80,5.40);
  for(const [r,row] of cape.entries()) for(const p of row) {
    const f=r/(cape.length-1);
    p[1]-=f*f*(.026-p[0]*.38);p[2]-=.026*f;p[0]-=.018*f;
  }
  t.satin(cape,0x57547e);t.stitch(cape[cape.length-1],.004,0xd9c6af,24);
  t.stitch(cape.map(r=>r[0]),.004,0xd9c6af);t.stitch(cape.map(r=>r[r.length-1]),.004,0xd9c6af);
  collar(t,0x6a708c,0xd5bbc2,true);cinch(t,0x282d46,gilt);
  for(const s of [-1,1]){
    t.stitch([[s*.128,.617,.052],[s*.097,.576,.074],[s*.081,.524,.077],[s*.069,.476,.068]],.0035,0xc3c9df,4);
    for(const y of [.556,.522,.49]) t.gem([s*.045,y,.084],[.005,.006,.0035],gilt);
  }
  t.shell([[.648,.023,.019,-.145],[.644,.058,.043,-.145],[.617,.067,.051,-.145],[.603,.063,.049,-.145]],0xbac0d0,18);
  t.shell([[.606,.066,.051,-.145],[.6,.063,.050,-.145]],gilt,18);
  const braid:V[]=[[-.128,.615,.058],[-.089,.580,.083],[-.034,.575,.094],[.055,.609,.079]];
  t.stitch(braid.map(p=>onBodice(p,.017)),.0038,gilt,8);
  t.stitch(braid.map(([x,y,z])=>onBodice([x,y+.009,z],.017)),.0027,0xe0deee,8);
  const moon:V[]=Array.from({length:10},(_,i)=>{const a=.39+i*.51;return onBodice([.067+.015*Math.sin(a),.618+.018*Math.cos(a),.078],.022);});
  t.stitch(moon,.0045,0xffdd9c,9);
  t.gem([0,.452,.090],[.023,.017,.009],gilt);sword(t);
}

function coral(t:Tailor) {
  tunic(t,0xafd6d2,.345,.158,.111);
  const skirt=t.cut([[.457,.115,.083],[.399,.143,.11],[.304,.181,.137],[.216,.188,.144],[.183,.185,.137]],32,-Math.PI,Math.PI,8,.007,.008);
  t.satin(skirt,0xffffff,brocadeUV);
  const coat=t.cut([[.455,.121,.089],[.395,.155,.124],[.325,.19,.148],[.280,.199,.155]],25,.32,TAU-.26,7,.007,.011);
  t.satin(coat,0xb2e1d9);t.stitch(coat[3],.0036,cream,25);
  ribbon(t,[[-.056,.668,.043,.021],[-.042,.638,.068,.024],[.01,.595,.085,.021],[.066,.54,.078,.020],[.088,.476,.057,.016]],cream,0xe5b98f);
  ribbon(t,[[.057,.670,.042,.023],[.045,.635,.071,.026],[-.009,.59,.087,.022],[-.066,.536,.082,.022],[-.09,.47,.059,.021]],0xf7e4d0,0xf3ac98,.012);
  cinch(t,0xde8d89,0xffd198);
  ribbon(t,[[-.049,.441,.086,.025],[-.043,.393,.130,.021],[-.053,.320,.161,.023],[-.079,.272,.159,.019]],0xe99e98,0xffddb5);
  ribbon(t,[[-.016,.443,.090,.012],[.007,.377,.146,.014],[.029,.311,.161,.014]],0xf2c692);
  t.bow([0,.464,-.087],.132,0xefaba2,0xffdeab);
  for(let i=0;i<5;i++) t.bead([-.050+i*.014,.463-.009*Math.sin(i*Math.PI/4),.087],[.0055,.0055,.004],0xffe1c3);
  t.gem([.021,.457,.091],[.011,.016,.006],0x7baaa9);shellFan(t);
}

function orbit(t:Tailor) {
  tunic(t,0xaf7555,.376,.151,.102);
  t.satin(t.cut([[.434,.123,.085],[.406,.141,.097],[.373,.151,.104]],26),0xffffff,brocadeUV);
  cinch(t,0x62493e,gilt);
  ribbon(t,[[0,.649,.063,.036],[0,.611,.081,.037],[0,.548,.092,.039],[0,.477,.082,.035]],0xe4c498);
  collar(t,0xeed5af,0xb48d69,true);
  ribbon(t,[[-.108,.642,.048,.012],[-.072,.599,.084,.013],[-.014,.548,.102,.013],[.055,.497,.089,.014],[.099,.451,.063,.014]],0x674b3b,0xdebe8e,.018);
  for(const s of [-1,1]){
    ribbon(t,[[s*.088,.538,.066,.026],[s*.087,.51,.072,.026],[s*.082,.488,.076,.020]],0xb5815b,0xe4b682);
    t.stitch([[s*.109,.53,.066],[s*.087,.523,.079],[s*.065,.53,.081]],.0034,0x674b3b);
    t.bead([s*.085,.518,.080],[.005,.005,.004],gilt);
  }
  t.bead([.14,.396,.047],[.050,.050,.029],0x79553d,-.15);
  ribbon(t,[[.135,.423,.070,.040],[.14,.403,.081,.042],[.143,.392,.079,.028]],0xc39569,0xd8b681);
  t.gem([.143,.398,.086],[.009,.009,.004],gilt);
  t.gem([0,.449,.090],[.019,.014,.006],gilt);compass(t);
}

function bamboo(t:Tailor) {
  tunic(t,0xa9c6b5,.379,.15,.103);
  const robe=t.cut([[.45,.116,.084],[.392,.15,.107],[.303,.17,.127],[.194,.192,.143],[.135,.189,.137]],32,-Math.PI,Math.PI,7,.007,.004);
  t.satin(robe,0xffffff,brocadeUV);
  const mantle=t.cut([[.455,.124,.092],[.397,.154,.113],[.292,.182,.141],[.176,.184,.151]],25,.34,TAU-.72,8,.009,.008);
  t.satin(mantle,0xa7c8b8);t.stitch(mantle[3],.0035,0xdce3c8,25);
  ribbon(t,[[-.046,.673,.041,.020],[-.024,.633,.072,.022],[.039,.579,.085,.026],[.085,.533,.074,.019]],0xe1e3cd,0x6d9486);
  ribbon(t,[[.052,.674,.042,.025],[.027,.636,.073,.025],[-.040,.577,.089,.026],[-.088,.523,.070,.025],[-.096,.46,.054,.020]],0xe9e9d4,0x6b9182,.012);
  cinch(t,0x5f8078,0xc3ba8e);
  ribbon(t,[[-.06,.441,.082,.017],[-.054,.374,.116,.021],[-.060,.291,.145,.020],[-.081,.208,.147,.017]],0xe2ddc2,0xb6b08a);
  t.stitch([[-.092,.455,.052],[-.063,.426,.092],[.014,.442,.091],[.078,.454,.067]],.004,0xcbbc8b,5);
  t.stitch([[.054,.446,.079],[.070,.417,.098],[.073,.383,.127],[.080,.361,.137]],.0035,0x7e826a,4);
  t.gem([.078,.379,.132],[.009,.012,.006],jade);
  t.shaped([[.080,.363,.137,.004],[.080,.355,.138,.009],[.084,.334,.141,.006]],0xa49b66,8);
  brushes(t);
}

const outfits:Record<Spirit,(t:Tailor)=>void>={rosette,nocturne,coral,orbit,bamboo};
export function addDollCostume(id:Spirit,add:DollAdd) {
  const t=tailor(add);
  legs(t,id);
  t.shell([[.761,.058,.054,0,.032],[.739,.064,.055,0,.032],[.714,.063,.054,0,.028],
    [.695,.057,.051,0,.021],[.683,.057,.051,0,.014],[.675,.069,.054,0,.008],[.663,.092,.058]],wardrobe[id].skin,24);
  sleeves(t,id);
  outfits[id](t);
}
