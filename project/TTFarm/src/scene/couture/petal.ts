import type { Atelier, Bind, Fabric, V } from "./atelier";

const tau = Math.PI * 2;
const pearl = 0xfff0e7;
const gold = 0xe8c388;

// A row of the pattern is an elliptical arc. The left and right ends can sit
// at different heights, so a single panel can sweep from a hip into a train.
type Cut = [leftY: number, rightY: number, width: number, depth: number, from: number, to: number];
function cut(rows: Cut[], pleat = 0, repeats = 1, count = 20): V[][] {
  return rows.map(([left, right, width, depth, from, to]) => Array.from({ length: count + 1 }, (_, i): V => {
    const u = i / count, theta = from + (to - from) * u;
    const ridge = pleat * Math.sin(Math.PI * u) * Math.cos(tau * repeats * u);
    return [(width + ridge) * Math.sin(theta), left + (right - left) * u,
      .003 + (depth + ridge) * Math.cos(theta)];
  }));
}
function drape(a: Atelier, rows: V[][], color: number, fabric: Fabric, bind: Bind, trim?: number) {
  a.shell(rows, color, fabric, bind, false);
  if (trim !== undefined) a.tube(rows[rows.length - 1], .0025, trim, "metal", bind);
}
function flower(a: Atelier, center: V, size: number, base: number, light: number, bind: Bind) {
  for (let i = 0; i < 5; i++) {
    const angle = tau * i / 5;
    const petal = (length: number, width: number, lift: number): V[] => [-1, 0, 1].map(s => [
      center[0] + size * (length * Math.sin(angle) + s * width * Math.cos(angle)),
      center[1] + size * (length * Math.cos(angle) - s * width * Math.sin(angle)),
      center[2] + size * (lift + .10 * (1 - Math.abs(s))),
    ]);
    a.shell([petal(.04, .03, 0), petal(.47, .28, .15), petal(.8, .40, .26), petal(1, .07, .32)],
      i % 2 ? light : base, "satin", bind, false);
  }
  a.gem([center[0], center[1], center[2] + size * .18], [size * .17, size * .20, size * .16], gold, "metal", bind);
}

function petalWaltz(a: Atelier) {
  const cream = 0xffe0da, blush = 0xf5a8b8, berry = 0xa34365;
  a.bodice(berry, pearl, "sweetheart");
  a.skirt({ hem: .714, width: .207, depth: .172, color: berry, pleats: 6, wave: .005 });
  // Each silk gore balloons at the hip, then rolls back under a gathered hem.
  for (let i = 0; i < 6; i++) {
    const axis = i * tau / 6;
    const rows = cut([
      [.955,.955,.149,.125,axis-.56,axis+.54],
      [.923,.913,.192,.157,axis-.55,axis+.56],
      [.854,.835,.253,.202,axis-.55,axis+.59],
      [.782,.767,.271,.216,axis-.53,axis+.58],
      [.716,.704,.229,.180,axis-.48,axis+.54],
      [.733,.725,.207,.168,axis-.47,axis+.52],
    ], .007, 1, 12);
    drape(a, rows, [blush,0xfabaaf,cream,blush,0xee91a7,cream][i], "satin", "skirt");
  }
  // Diagonal plissé scarf, carried over the left shoulder and down the back.
  for (const face of [-1, 1]) {
    const levels = [
      [.097,.969,.091,.030], [.072,1.042,.115,.038], [.008,1.115,.141,.048],
      [-.064,1.192,.121,.054], [-.112,1.248,.077,.051], [-.135,1.297,.026,.039],
    ];
    const yShift = face < 0 ? -.014 : 0;
    const rows = levels.map(([x,y,z,w]) => Array.from({length: 11}, (_, n): V => {
      const u = (n - 5) / 5;
      return [x + u*w, y + u*w*.63 + yShift, face*(z+.009*Math.cos(3*Math.PI*u))];
    }));
    drape(a, rows, cream, "satin", "torso");
    a.tube(rows.map(r => r[0]), .003, gold, "metal", "torso");
  }
  // Broad asymmetric silk petals lift away from the shoulder like an unfolded corsage.
  for (let i = 0; i < 4; i++) {
    const angle = -1.02 + i * .52;
    const blade = [[0,.009,0],[.042,.035,.024],[.091,.043,.020],[.126,.008,-.001]].map(([reach,w,z]) =>
      [-1,0,1].map((u): V => [-.128 + reach*Math.sin(angle) + w*u*Math.cos(angle),
        1.267 + reach*Math.cos(angle) - w*u*Math.sin(angle), .040 + z + .014*(1-Math.abs(u))]));
    drape(a, blade, i % 2 ? blush : cream, "satin", "torso");
  }
  a.shoes(berry, cream, "pump");
  flower(a, [.098,1.553,.072], .032, berry, blush, "head");
  a.spark([-.129,1.28,.058], .018, cream, "torso");
}

function roseCadenza(a: Atelier) {
  const wine = 0x622943, lacquer = 0xab3659, petal = 0xe793a7;
  a.bodice(wine, gold, "sweetheart");
  a.skirt({ hem: .383, width: .205, depth: .171, color: wine, pleats: 6, wave: .006, slant: .047 });
  // One continuous side train: the opening faces the forward leg and its back
  // point falls to the ankle. The turning edge exposes a broad pink silk facing.
  const train = cut([
    [.956,.956,.151,.128,.31,4.32], [.900,.884,.182,.155,.44,4.40],
    [.808,.796,.211,.178,.53,4.47], [.687,.594,.235,.203,.64,4.56],
    [.622,.385,.268,.244,.70,4.59],
  ], .012, 3, 38);
  const bottom = train[train.length-1].map(([x,y,z],i):V => {
    const u = i/(train[0].length-1);
    return [x*(1+.18*Math.sin(Math.PI*u)),y-.314*Math.sin(Math.PI*u)**1.7,z<0?z*1.32:z];
  });
  const trainRows=[...train,bottom];
  drape(a,trainRows,lacquer,"satin","skirt",gold);
  const facing=trainRows.map((row,j)=>Array.from({length:7},(_,i):V=>{
    const u=i/6*(2+j*.85), k=Math.floor(u), f=u-k;
    const p=row[k],q=row[k+1];
    return [(p[0]+(q[0]-p[0])*f)*1.032,p[1]+(q[1]-p[1])*f,(p[2]+(q[2]-p[2])*f)*1.032];
  }));
  drape(a,facing,petal,"satin","skirt");
  const backPleat=trainRows.map((row,j)=>row.slice(22-j,26).map(([x,y,z]):V=>[x*1.027,y,z*1.032]));
  // Keep a constant stitch count as the inset broadens into a full rear pleat.
  const rear=backPleat.map(row=>Array.from({length:10},(_,i):V=>{
    const t=i*(row.length-1)/9, k=Math.floor(t), p=row[k], q=row[Math.min(k+1,row.length-1)], u=t-k;
    return [p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u,p[2]+(q[2]-p[2])*u];
  }));
  drape(a,rear,wine,"satin","skirt");
  // Bias-cut one-shoulder bodice, shirred at the opposite hip.
  for (const face of [-1,1]) {
    const panel: V[][] = [
      [[-.109,.956,.095],[-.062,.951,.134],[-.018,.952,.139]],
      [[-.119,1.022,.069],[-.038,1.017,.130],[.068,1.052,.113]],
      [[-.132,1.101,.066],[-.013,1.107,.148],[.109,1.153,.103]],
      [[-.120,1.165,.088],[.023,1.188,.139],[.138,1.226,.064]],
      [[-.098,1.192,.092],[.059,1.216,.113],[.128,1.27,.035]],
    ].map(row=>row.map(([x,y,z])=>[x,y,face*z]));
    drape(a,panel,lacquer,"satin","torso");
    a.tube(panel[4], .003, gold, "metal", "torso");
  }
  const ruffle: V[][] = [
    [[.085,1.224,.096],[.130,1.240,.050],[.146,1.243,-.032]],
    [[.090,1.265,.108],[.157,1.279,.042],[.174,1.276,-.052]],
    [[.098,1.292,.090],[.171,1.314,.047],[.166,1.307,-.064]],
    [[.108,1.295,.072],[.158,1.297,.032],[.150,1.288,-.053]],
  ];
  drape(a,ruffle,petal,"satin","torso",gold);
  a.sleeves("glove",wine,gold,"satin",-1);
  a.shoes(wine,gold,"boot");
  flower(a,[.108,1.546,.068],.037,lacquer,petal,"head");
  a.shell([[[.102,1.55,.069],[.117,1.537,.045],[.121,1.535,.010]],
    [[.092,1.505,.094],[.128,1.483,.063],[.133,1.507,.018]]], wine, "lace", "head", false);
}

function peachFan(a: Atelier) {
  const peach = 0xffb7a0, lacquer = 0xbe716e, tea = 0x456d67, bone = 0xffdeb6;
  a.bodice(peach,bone,"wrap");
  a.skirt({hem:.709,width:.214,depth:.177,color:tea,pleats:8,wave:.005,slant:.013});
  a.ring([[.936,.149,.128,.004],[.973,.142,.125,.004],[1.015,.127,.123,.006],
    [1.056,.131,.125,.006]],tea,"satin","torso");
  // Cropped crossover bolero. The dark fitted waist between jacket and skirt
  // also reads in back view; the kimono folds end in asymmetric mitred corners.
  for (const face of [-1,1]) {
    const left: V[][] = [
      [[-.132,1.034,.052],[-.060,1.009,.122],[.025,1.023,.130]],
      [[-.144,1.136,.047],[-.066,1.105,.129],[.061,1.078,.123]],
      [[-.138,1.235,.055],[-.089,1.201,.113],[.056,1.122,.126]],
      [[-.085,1.295,.066],[-.030,1.229,.120],[.085,1.124,.114]],
    ].map(row=>row.map(([x,y,z])=>[x,y,face*z]));
    drape(a,left,peach,"satin","torso");
    const right: V[][] = [
      [[-.102,1.034,.087],[.003,1.044,.135],[.131,1.063,.053]],
      [[-.061,1.101,.136],[.055,1.104,.126],[.141,1.15,.052]],
      [[.010,1.173,.14],[.085,1.19,.115],[.138,1.231,.047]],
      [[.076,1.286,.079],[.098,1.28,.066],[.123,1.263,.049]],
    ].map(row=>row.map(([x,y,z])=>[x,y,face*(z+.003)]));
    drape(a,right,peach,"satin","torso");
    a.tube(right.map(x=>x[0]),.008,tea,"satin","torso");
    a.tube(right.map(row=>[row[0][0]+.004,row[0][1]+.002,row[0][2]+face*.008]),.003,bone,"satin","torso");
  }
  a.sleeves("cap",peach,bone,"satin");
  // Angular knife pleats wrap only the long side of this asymmetric skirt.
  for(let i=0;i<7;i++) {
    const angle=-.25+i*.535, long=Math.sin(Math.PI*(i+.5)/7);
    const blade=cut([
      [.958,.958,.154,.130,angle-.24,angle+.25],
      [.862,.852,.204,.162,angle-.17,angle+.32],
      [.771,.754,.235,.181,angle-.14,angle+.42],
      [.721-long*.103,.688-long*.121,.249,.201,angle-.14,angle+.44],
    ],.012,1,8);
    drape(a,blade,[peach,bone,lacquer,peach,bone,lacquer,peach][i],"satin","skirt",bone);
  }
  // The oversized, flat origami obi spans the opposite hip.
  for(const face of [-1,1]) {
    const folded: V[][] = [
      [[-.154,.919,.071],[-.102,.955,.122],[-.028,.97,.146]],
      [[-.184,.928,.066],[-.140,.978,.108],[-.023,.979,.147]],
      [[-.183,1.002,.060],[-.128,1.005,.109],[-.023,.98,.145]],
      [[-.137,.988,.065],[-.086,.988,.123],[-.023,.978,.144]],
    ].map(row=>row.map(([x,y,z])=>[x,y,face*z]));
    drape(a,folded,tea,"satin","torso");
    a.tube(folded[2],.0033,gold,"metal","torso");
  }
  // A small fan comb repeats the alternating dark/light facets of the skirt.
  const hinge:V=[.094,1.553,.066];
  for(let i=0;i<8;i++) {
    const angle=-.28+i*.248;
    const tip=(t:number,r:number):V=>[hinge[0]+r*Math.sin(t),hinge[1]+r*Math.cos(t),hinge[2]+.006*(i%2)];
    drape(a,[[tip(angle,.007),tip(angle+.248,.007)],[tip(angle,.059),tip(angle+.248,.059)]],i%2?peach:bone,"satin","head");
  }
  a.gem(hinge,[.009,.009,.006],gold,"metal","head");
  a.shoes(lacquer,bone,"slipper");
}

function lilacBallet(a: Atelier) {
  const iris=0x766395, lilac=0xc6b0df, frost=0xf0dcf4, ink=0x5a4768;
  a.bodice(lilac,frost,"square");
  a.skirt({hem:.678,width:.220,depth:.184,color:iris,pleats:10,wave:.014,slant:.014});
  a.skirt({waist:.923,hem:.686,width:.304,depth:.220,color:lilac,fabric:"tulle",pleats:12,wave:.018,slant:.034});
  a.skirt({waist:.938,hem:.744,width:.327,depth:.233,color:frost,fabric:"tulle",pleats:12,wave:.018,slant:.031});
  // Low V-waist corselet, knitted-look side gussets and a legible front busk.
  const corset=cut([
    [.934,.934,.157,.135,-1.18,1.18],[1.009,1.009,.126,.122,-1.17,1.17],
    [1.079,1.079,.132,.123,-1.16,1.16],[1.158,1.158,.148,.137,-1.13,1.13],
  ],0,1,24);
  corset[0]=corset[0].map(([x,y,z],i):V=>[x,y-.046*Math.sin(Math.PI*i/24),z]);
  drape(a,corset,iris,"satin","torso");
  for(const s of [-1,1]){
    const bones:V[]=[[s*.072,.926,.119],[s*.050,1.010,.126],[s*.054,1.079,.13],[s*.094,1.158,.107]];
    a.tube(bones,.0045,frost,"satin","torso");
  }
  for(let i=0;i<4;i++) {
    const y=.967+i*.037,z=i===0?.143:.136;
    for(const s of [-1,1]) drape(a,[
      [[s*.041,y,z],[s*.044,y+.006,z]], [[-s*.043,y+.037,z+.004],[-s*.04,y+.043,z+.004]],
    ],frost,"satin","torso");
  }
  // Ruched hip band spirals below the basque; its knot releases two long ribbons.
  const hip=cut([
    [.943,.943,.161,.141,-Math.PI,Math.PI],
    [.917,.917,.177,.151,-Math.PI,Math.PI],
    [.887,.887,.184,.155,-Math.PI,Math.PI],
  ],.004,10,48);
  for(const row of hip)for(let i=0;i<row.length;i++)row[i][1]+=.031*Math.sin(i*tau/48+.4);
  drape(a,hip,lilac,"satin","skirt",frost);
  a.bow([-.142,.927,-.101],.074,ink,"skirt");
  for(const [i,s] of [-1,1].entries()){
    const ribbon:V[][]=[
      [[-.145,.93,-.107],[-.119,.932,-.124]],
      [[-.189,.83,-.145],[-.156,.84,-.171]],
      [[-.210,.69,-.194],[-.172,.686,-.220]],
      [[-.142,.55,-.227],[-.110,.566,-.229]],
      [[-.091,.448,-.194],[-.060,.464,-.197]],
    ].map(row=>row.map(([x,y,z])=>[x+s*i*.092,y+i*.086,z+i*.026]));
    drape(a,ribbon,i?frost:ink,"satin","skirt");
  }
  a.shoes(lilac,iris,"ribbon");
  for(const s of [-1,1])for(const winding of [-1,1]){
    const bands=Array.from({length:24},(_,i):V[]=>{
      const t=i/23,angle=winding*(6.0*t+.07),y=.172+t*.249;
      const w=.032+.020*Math.sin(t*Math.PI*.62),d=.039+.021*Math.sin(t*Math.PI*.55);
      return [-1,1].map(edge=>[s*.079+w*Math.sin(angle),y+edge*.0048,-.038+.020*t+d*Math.cos(angle)]);
    });
    a.shell(bands,iris,"satin","leg",false);
  }
  a.bow([-.083,1.537,.052],.057,ink,"head");
}

// Pink butterfly gauze: a beaded sweetheart bodice under a long, open-front
// tulle robe. Layered skirts fall to the floor; butterflies and star dust
// gather at the hem and waist.
function butterflyVeil(a: Atelier) {
  const blush=0xf9cbd9, rose=0xefa6bf, pearl=0xfff6f4, crystal=0xffe9ef;
  a.bodice(blush,pearl,"sweetheart");
  // The fine halter straps cross the collarbone instead of the shoulder.
  for(const s of [-1,1]){
    a.tube([[s*.076,1.222,.086],[s*.055,1.274,.068],[s*.026,1.318,.043],[0,1.332,.036]],
      .0028,pearl,"metal","torso");
    // Crystal beading along the sweetheart edge and under the bust.
    for(let i=0;i<5;i++) a.spark([s*(.028+i*.025),1.232-i*.008,.104-i*.004],.007,crystal,"torso");
  }
  // Barely-there boning threads and a narrow ribbon at the natural waist.
  for(const s of [-1,1]) a.tube([[s*.105,.968,.113],[s*.090,1.053,.121],[s*.058,1.151,.126]],.0022,pearl,"metal","torso");
  a.bow([0,1.004,.141],.046,rose,"torso");
  // A pale satin underskirt carries the blush tulle to the floor.
  a.skirt({hem:.152,width:.246,depth:.205,color:0xf9e4eb,pleats:9,wave:.009});
  a.skirt({waist:.963,hem:.101,width:.372,depth:.301,color:blush,fabric:"tulle",pleats:15,wave:.024,slant:.020});
  a.skirt({waist:.974,hem:.116,width:.344,depth:.278,color:pearl,fabric:"tulle",pleats:13,wave:.020,slant:.016});
  a.skirt({waist:.986,hem:.145,width:.313,depth:.253,color:crystal,fabric:"tulle",pleats:11,wave:.017,slant:.012});
  // Open-front robe: sheer shoulder panels continue into floor-length side gores.
  for(const s of [-1,1]){
    drape(a,cut([
      [1.304,1.296,.062,.071,s*.07,s*1.67],[1.232,1.208,.166,.129,s*.14,s*2.02],
      [1.102,1.056,.222,.169,s*.20,s*2.30],[.980,.944,.246,.188,s*.24,s*2.46],
    ],.008,1,16),pearl,"lace","torso");
    drape(a,cut([
      [.970,.970,.178,.149,s*.26,s*2.82],[.842,.820,.252,.206,s*.30,s*2.88],
      [.642,.608,.320,.254,s*.34,s*2.94],[.418,.378,.382,.301,s*.38,s*2.98],
      [.144,.108,.428,.336,s*.42,s*3.02],
    ],.020,2,26),blush,"lace","skirt");
    // A second transparent layer catches light at the side seams.
    drape(a,cut([
      [.958,.958,.168,.140,s*.42,s*2.55],[.780,.758,.230,.187,s*.46,s*2.62],
      [.540,.508,.303,.239,s*.52,s*2.68],[.300,.266,.371,.284,s*.58,s*2.74],
      [.120,.092,.427,.324,s*.64,s*2.80],
    ],.028,3,22),crystal,"tulle","skirt");
    for(let i=0;i<4;i++){
      const p:V=[s*(.16+i*.06),.52-i*.11,.15-i*.03];
      a.spark(p,.026,crystal,"skirt");
    }
    // The huge outer sleeve is cut as a hanging side panel, the way the
    // reference robe falls from the shoulder past the hand.
    drape(a,cut([
      [1.306,1.302,.058,.069,s*.05,s*1.50],[1.212,1.176,.128,.112,s*.10,s*1.78],
      [1.020,.980,.188,.156,s*.15,s*1.96],[.790,.748,.246,.202,s*.19,s*2.08],
      [.550,.508,.296,.241,s*.23,s*2.16],[.348,.306,.326,.262,s*.25,s*2.22],
    ],.020,1,18),blush,"lace","torso");
    drape(a,cut([
      [1.300,1.296,.062,.073,s*.10,s*1.60],[1.196,1.160,.136,.120,s*.15,s*1.88],
      [.990,.950,.198,.166,s*.20,s*2.05],[.748,.704,.258,.214,s*.24,s*2.16],
      [.486,.444,.306,.252,s*.28,s*2.22],[.302,.266,.336,.272,s*.30,s*2.28],
    ],.026,2,18),crystal,"tulle","torso");
    a.tube([[s*.25,1.020,.155],[s*.25,.348,.260]],.0026,pearl,"metal","torso");
  }
  a.tube([[.015,1.246,.128],[.120,1.276,.110],[.225,1.301,.075],[.330,1.296,.045]],.0024,pearl,"metal","torso");
  // Ribbon streamers from the waist bow fall over the front of the skirt.
  for(const s of [-1,1]) drape(a,[
    [[s*.012,.994,.150],[s*.026,.990,.156]],
    [[s*.030,.902,.170],[s*.046,.894,.179]],
    [[s*.038,.760,.194],[s*.060,.742,.203]],
    [[s*.030,.610,.214],[s*.052,.586,.221]],
    [[s*.010,.472,.224],[s*.030,.446,.230]],
  ],rose,"satin","skirt");
  // Waist and hair butterflies.
  for(const [center,size,bind] of [
    [[-.126,.998,.140],.060,"torso"],[[.108,1.040,.142],.045,"torso"],
    [[-.104,1.548,.058],.075,"head"],[[.096,1.512,.066],.055,"head"],
    [[-.245,.560,.300],.115,"skirt"],[[.262,.470,.330],.125,"skirt"],
    [[-.288,.340,.360],.095,"skirt"],[[.300,.250,.370],.085,"skirt"],
    [[-.110,.380,.385],.075,"skirt"],[[.118,.310,.390],.080,"skirt"],
  ] as [V,number,Bind][]){
    const [x,y,z]=center;
    for(const s of [-1,1]) for(const up of [1,-1]){
      const wing:V[][]=[
        [[x,y,z],[x+s*size*.26,y+up*size*.10,z+.007],[x+s*size*.38,y+up*size*.22,z+.005]],
        [[x+s*size*.42,y+up*size*.13,z+.014],[x+s*size*.70,y+up*size*.40,z+.008],[x+s*size*.78,y+up*size*.28,z+.001]],
        [[x+s*size*.64,y-up*size*.08,z+.015],[x+s*size*.86,y-up*size*.18,z+.007],[x+s*size*.88,y-up*size*.04,z+.002]],
      ];
      a.shell(wing,up>0?0xe36f9d:0xffc6dc,"lace",bind,false);
      a.spark([x+s*size*.58,y+up*size*.18,z+.020],size*.16,0xfff0f6,bind);
      a.tube([[x+s*size*.30,y+up*size*.12,z+.010],[x+s*size*.50,y+up*size*.20,z+.012]],size*.008,rose,"satin",bind);
    }
    a.tube([[x,y-size*.02,z+.002],[x,y+size*.19,z+.002]],size*.020,rose,"satin",bind);
  }
  a.shoes(rose,pearl,"pump");
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    a.spark([Math.sin(angle)*.278,.24+.02*Math.sin(i*2.1),Math.cos(angle)*.22],.018,crystal,"skirt");
  }
}

function champagneBell(a: Atelier) {
  const ivory=0xffedce, goldSilk=0xd8b780, leaf=0x6e8878, lining=0x9ca791;
  a.skirt({hem:.331,width:.245,depth:.201,color:ivory,pleats:5,wave:.006,train:.024});
  // A panelled cone. The sage insert widens from a single point at the waist
  // into a graphic stripe at the front; two ivory gores meet at the back.
  for(const s of [-1,1]){
    const gore=cut([
      [.968,.968,.150,.127,s*.025,s*3.13],[.876,.876,.182,.149,s*.08,s*3.13],
      [.717,.717,.214,.184,s*.14,s*3.13],[.525,.525,.249,.206,s*.21,s*3.13],
      [.319,.31,.277,.226,s*.28,s*3.13],
    ],.005,2,24);
    drape(a,gore,ivory,"satin","skirt",gold);
  }
  const stripe=cut([
    [.961,.961,.152,.129,-.047,.047], [.866,.866,.185,.153,-.101,.101],
    [.716,.716,.219,.187,-.16,.16], [.521,.521,.253,.211,-.23,.23],
    [.322,.322,.280,.234,-.296,.296],
  ],0,1,10);
  drape(a,stripe,leaf,"satin","skirt");
  // Split opera cape: a crisp shoulder fold in front and long, separate wings behind.
  for(const s of [-1,1]){
    const cape=cut([
      [1.308,1.310,.062,.069,s*.20,s*3.02],[1.287,1.282,.136,.105,s*.25,s*3.04],
      [1.240,1.235,.184,.129,s*.34,s*3.07],[1.196,1.135,.195,.155,s*.39,s*3.07],
      [1.151,.788,.218,.209,s*.53,s*2.99],
    ],.009,1,24);
    const tail=cape[cape.length-1].map(([x,y,z],i):V=>{
      const u=i/24;
      return [x*(1+.09*Math.sin(Math.PI*u)),y-.097*Math.sin(Math.PI*u)**2,z<0?z-.035*Math.sin(Math.PI*u):z];
    });
    drape(a,[...cape.slice(0,-1),tail],ivory,"satin","torso",gold);
    const lapel=cut([
      [1.309,1.30,.066,.072,s*.1,s*.52],[1.283,1.251,.137,.11,s*.10,s*.67],
      [1.219,1.172,.19,.143,s*.25,s*.74],[1.151,1.094,.22,.165,s*.52,s*.81],
    ],.003,1,8);
    drape(a,lapel,goldSilk,"satin","torso");
    const inner=cut([
      [1.237,1.235,.177,.122,s*2.71,s*3.12],[1.101,1.079,.19,.153,s*2.72,s*3.09],
      [.802,.788,.209,.20,s*2.74,s*3.06],
    ],0,1,8);
    drape(a,inner,lining,"satin","torso");
  }
  a.ring([[1.278,.076,.065,-.013],[1.309,.068,.060,-.015]],goldSilk,"satin","torso");
  a.gem([0,1.255,.089],[.013,.021,.009],gold,"metal","torso");
  // One lily-of-the-valley pendant hangs from the curved gold head pin.
  const pin:V[]=[[-.059,1.589,.052],[-.104,1.605,.044],[-.134,1.586,.036],[-.137,1.56,.040]];
  a.tube(pin,.0036,gold,"metal","head");
  const shell=Array.from({length:5},(_,j)=>Array.from({length:20},(_,i):V=>{
    const t=i*tau/20,r=[.002,.014,.019,.020,.025][j];
    return [-.137+r*Math.sin(t),1.56-j*.007+(j===4?.003*Math.cos(5*t):0),.040+r*Math.cos(t)];
  }));
  a.shell(shell,ivory,"satin","head");
  a.pearl([-.137,1.526,.040],[.005,.007,.005],gold,"metal","head");
  a.shoes(goldSilk,ivory,"pump");
}

export function buildPetal(a: Atelier, id: string): void {
  switch (id) {
    case "petal-waltz": return petalWaltz(a);
    case "rose-cadenza": return roseCadenza(a);
    case "peach-fan": return peachFan(a);
    case "lilac-ballet": return lilacBallet(a);
    case "champagne-bell": return champagneBell(a);
    case "butterfly-veil": return butterflyVeil(a);
  }
}
