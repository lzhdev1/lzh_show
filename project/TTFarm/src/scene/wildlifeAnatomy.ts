import type { AnimalSpecies } from "../game/ranch";
import { styles } from "./ranchSpecies";

export const LOCAL_WILDLIFE = ["redPanda","raccoon","alpaca","penguin","duck","crane"] as const;
export type Wildlife = typeof LOCAL_WILDLIFE[number];
export const isWildlife = (value: AnimalSpecies): value is Wildlife => (LOCAL_WILDLIFE as readonly AnimalSpecies[]).includes(value);
export const isBird = (s: Wildlife) => s==="penguin" || s==="duck" || s==="crane";

// All six original skins follow a spine chart from tail (0) to nose (24).
// y and z are section centres. The transverse plane tilts along the spine.
export interface Rib { x:number; y:number; z:number; w:number; d:number; pitch:number }
type Loft=[z:number,y:number,w:number,d:number,pitch?:number];

// Separate bird cages give the emperor penguin its vertical keel, the mallard its
// broad waterline, and the crane a long S-neck with a horizontal, tapering bill.
const birds:Record<"penguin"|"duck"|"crane", Loft[]> = {
  penguin:[
    [-.29,.08,.006,.006],[-.265,.084,.040,.015],[-.23,.11,.072,.030],[-.193,.135,.087,.042],
    [-.151,.15,.098,.069,.5],[-.105,.17,.114,.087,.8],[-.079,.196,.135,.108,1.06],
    [-.056,.229,.151,.122,1.25],[-.040,.267,.163,.134,1.38],[-.027,.318,.175,.148,1.39],
    [-.017,.384,.178,.151,1.42],[-.006,.441,.173,.145,1.39],[.006,.499,.164,.133,1.36],
    [.019,.558,.147,.115,1.38],[.025,.609,.107,.094,1.53],[.028,.667,.085,.089,1.42],
    [.034,.709,.077,.080,1.18],[.047,.744,.077,.071,.78],[.072,.761,.075,.059,.22],
    [.097,.757,.062,.049,-.23],[.122,.745,.045,.030,-.32],[.147,.737,.036,.022,-.31],
    [.189,.723,.023,.016,-.30],[.224,.710,.012,.009,-.32],[.241,.700,.002,.002,-.35],
  ],
  duck:[
    [-.422,.277,.004,.008],[-.399,.264,.036,.013],[-.372,.256,.057,.019],[-.338,.250,.081,.029],
    [-.301,.242,.093,.045],[-.241,.232,.115,.072],[-.185,.221,.140,.095],[-.127,.214,.157,.109],
    [-.057,.214,.171,.118],[.008,.216,.172,.122],[.071,.221,.167,.121],[.123,.239,.153,.110],
    [.164,.264,.130,.097,.18],[.183,.293,.101,.083,.64],[.181,.331,.068,.058,1.47],
    [.173,.375,.062,.059,1.63],[.169,.417,.068,.063,1.32],[.182,.449,.079,.067,.78],
    [.209,.463,.082,.068,.28],[.236,.455,.077,.057,-.18],[.256,.434,.062,.037,-.32],
    [.280,.426,.058,.021,-.18],[.330,.416,.051,.016,-.14],[.371,.412,.042,.011,0],
    [.393,.413,.014,.009,.06],
  ],
  crane:[
    [-.600,.649,.005,.008],[-.547,.655,.056,.014],[-.498,.667,.083,.022],[-.452,.682,.099,.033],
    [-.390,.685,.110,.053],[-.313,.690,.126,.077],[-.228,.690,.146,.106],[-.145,.694,.155,.119],
    [-.061,.695,.166,.130],[.014,.705,.163,.132],[.080,.717,.153,.129],[.136,.740,.134,.121],
    [.201,.771,.107,.102,.42],[.240,.827,.066,.065,.89],[.239,.915,.045,.047,1.56],
    [.200,1.014,.042,.046,1.74],[.167,1.102,.043,.043,1.70],[.175,1.164,.052,.049,.93],
    [.218,1.190,.056,.048,.24],[.257,1.187,.049,.036,-.10],[.287,1.176,.037,.023,-.13],
    [.325,1.171,.030,.017,-.09],[.393,1.164,.020,.013,-.09],[.463,1.158,.010,.008,-.09],
    [.486,1.155,.002,.002,-.08],
  ],
};

export function ribsFor(species: Wildlife): Rib[] {
  if(species==="penguin" || species==="duck" || species==="crane")
    return birds[species].map(([z,y,w,d,pitch=0])=>({x:0,z,y,w,d,pitch}));
  const {width:w,belly:b,length:l,leg,neck,face:f}=styles[species].body;
  const camel=species==="alpaca",red=species==="redPanda";
  const y=leg+.73*b;
  const headZ=l*(camel?.89:1.02),headY=y+neck+(camel?0:.02);
  const tailLength=camel?.38:red?1.58:1.33;
  const tailWidth=w*(camel?.41:red?.85:.70);
  const tailY=y+b*.46;
  const tip=camel?tailY-.20:tailY-.14;
  const cross:Loft[]=[
    [-l*(1+tailLength),tip,.004,.006],[-l*(1+.88*tailLength),tip-.024,tailWidth*.54,tailWidth*.59],
    [-l*(1+.57*tailLength),tailY-b*.82,tailWidth,tailWidth*1.02],[-l*(1+.24*tailLength),tailY-b*.44,tailWidth*.82,tailWidth*.90],
    [-l*.99,tailY,w*.23,b*.34],[-l*.90,y+b*.04,w*.69,b*.85],[-l*.75,y+b*.035,w*.97,b*1.00],
    [-l*.53,y+b*.075,w*.98,b*.98],[-l*.32,y+b*.04,w*.91,b*.88],
    [-l*.09,y+b*.16,w*.81,b*.78], [l*.13,y+b*.15,w*.92,b*.96],
    [l*.34,y+b*.21,w*1.04,b*1.09],[l*.54,y+b*.14,w*1.02,b*1.05],
    [l*.66,y+neck*.26,w*(camel?.57:.79),b*(camel?.78:.89),camel?.67:.18],
    [l*(camel?.706:.79),y+neck*(camel?.67:.57),camel?w*.37:w*.65,camel?b*.47:b*.74,camel?1.35:.39],
    [headZ-f*.64,headY-f*.19,camel?f*.67:f*.82,camel?f*.74:f*.88,camel?1.0:.29],
    [headZ-f*.37,headY+f*.009,f*.92,f*.86,.15],
    [headZ-f*.02,headY+f*.063,f*1.01,f*.86,.06],
    [headZ+f*.29,headY+f*.030,f*.995,f*.75,-.05],
    [headZ+f*.56,headY-f*.053,f*.80,f*.62,-.11],
    [headZ+f*.81,headY-f*.17,f*.58,f*.43,-.09],
    [headZ+f*.99,headY-f*.22,f*.49,f*.37,-.055],
    [headZ+f*(camel?1.47:1.35),headY-f*.23,f*(camel?.53:.37),f*.28,-.03],
    [headZ+f*(camel?1.66:1.55),headY-f*.17,f*(camel?.44:.25),f*(camel?.25:.19),-.015],
    [headZ+f*(camel?1.73:1.59),headY-f*.13,f*(camel?.33:.17),f*(camel?.18:.115)],
  ];
  return cross.map(([z,y,w,d,pitch=0],k)=>({x:k<5&&!camel?[.245,.229,.113,.015,0][k]:0,z,y,w,d,pitch}));
}
