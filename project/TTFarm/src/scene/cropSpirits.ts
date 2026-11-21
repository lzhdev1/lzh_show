import * as THREE from "three";
import type { Spirit } from "../game/weather";

type V = [number, number, number];
type Add = (geo: THREE.BufferGeometry, color: number, pos: V, rot?: V, scale?: V) => void;
const TAU = Math.PI * 2;
const palettes = {
  rosette: { hair: 0xbb6684, deep: 0x8c466d, cloth: 0xf6a5b7, lining: 0xffe9ce, metal: 0xf6ce76, eye: 0x647647 },
  nocturne: { hair: 0x686a9a, deep: 0x343958, cloth: 0x56699e, lining: 0xc4b6e6, metal: 0xd3dce9, eye: 0x7977c2 },
  coral: { hair: 0x76b8c4, deep: 0x497c93, cloth: 0x7ed8d5, lining: 0xffd7d5, metal: 0xffe7b6, eye: 0x388f9f },
  orbit: { hair: 0xa26441, deep: 0x544661, cloth: 0xdd9155, lining: 0xe3dfc7, metal: 0xf2c86a, eye: 0x54619a },
  bamboo: { hair: 0x3c5e58, deep: 0x365752, cloth: 0x82baa3, lining: 0xe9edce, metal: 0xe1bc75, eye: 0x52886c },
};

/** 五位田间精灵均为立体模型。刺绣、发饰和手持物与主体合批。 */
export function addCropSpirit(id: Spirit, add: Add) {
  const p = palettes[id], skin = 0xffdcc3;
  const orb = (c: number, at: V, scale: V, rz = 0) =>
    add(new THREE.SphereGeometry(1, 14, 9), c, at, [0,0,rz], scale);
  const gem = (c: number, at: V, scale: V, rz = 0) =>
    add(new THREE.OctahedronGeometry(1), c, at, [0,.28,rz], scale);
  const tube = (c: number, from: V, to: V, r: number, top = r) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    const geo = new THREE.CylinderGeometry(top, r, d.length(), 9);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()));
    add(geo, c, a.lerp(b,.5).toArray() as V);
  };
  function fluted(y: number, height: number, waist: number, width: number, c: number, pleats = 9, angle = 0) {
    const geo = new THREE.CylinderGeometry(waist, width, height, 60, 2, false);
    const pos = geo.getAttribute("position");
    for (let i=0; i<pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i), h=pos.getY(i);
      const a=Math.atan2(z,x), t=.5-h/height;
      const fold=1+t*(.048*Math.cos(a*pleats)+.035*Math.sin(a*3));
      pos.setXYZ(i,x*fold,h+.016*t*Math.cos(a*pleats),z*.86*fold);
    }
    geo.computeVertexNormals();
    add(geo,c,[0,y,0],[0,angle,0]);
  }

  for (const side of [-1,1]) {
    orb(p.deep,[side*.095,.18,0],[.067,.146,.074]);
    orb(p.lining,[side*.097,.078,.036],[.08,.061,.10]);
    orb(p.metal,[side*.095,.105,.092],[.023,.017,.018]);
  }
  orb(p.cloth,[0,.49,0],[.191,.226,.132]);
  fluted(.40,.05,.177,.184,p.metal);
  orb(p.lining,[0,.63,.013],[.173,.075,.14]);
  for (const s of [-1,1]) {
    const raised = s===1 && id!=="rosette";
    const hand: V=[s*(raised?.263:.225), raised?.54:.395,.058];
    tube(p.cloth,[s*.126,.59,0],hand, .073, id==="coral"?.106:.059);
    orb(skin,hand,[.055,.061,.049]);
  }

  // 头身比接近 1:1，眼睛分巩膜、虹膜、瞳孔和两点高光。
  orb(p.hair,[0,.918,-.052],[.294,.303,.228]);
  orb(skin,[0,.894,.027],[.268,.251,.216]);
  for (const s of [-1,1]) {
    const x=s*.102;
    orb(0x443649,[x,.905,.216],[.063,.081,.028],-s*.09);
    orb(0xfff4e4,[x,.899,.226],[.058,.073,.023],-s*.09);
    orb(p.eye,[x+s*.004,.897,.246],[.041,.060,.013]);
    orb(0x303349,[x+s*.004,.904,.256],[.022,.039,.008]);
    orb(0xffffff,[x-.013,.929,.264],[.013,.014,.006]);
    orb(0xffeabb,[x+.018,.88,.258],[.007,.008,.004]);
    orb(0xf8ada6,[s*.173,.846,.186],[.043,.014,.013],s*.1);
    orb(p.deep,[x,.985,.205],[.049,.012,.01],s*.10);
    orb(skin,[s*.254,.872,.008],[.031,.052,.034]);
    gem(p.metal,[s*.259,.83,.018],[.018,.027,.013]);
    orb(p.hair,[s*.225,.955,.065],[.081,id==="coral"?.231:.154,.122],s*.10);
  }
  orb(0xbe776b,[0,.807,.222],[.027,.007,.006]);
  for (let j=0; j<5; j++) {
    const x=(j-2)*.083;
    orb(p.hair,[x,1.065-.015*Math.abs(j-2),.137],[.082,.104+(j%2)*.018,.069],-.26+(j-2)*.12);
  }
  const ribbon = (at: V, c: number, width: number) => {
    for(const s of [-1,1]) orb(c,[at[0]+s*width*.50,at[1]+.009,at[2]],[width*.6,width*.36,width*.23],s*.42);
    gem(p.metal, at,[width*.25,width*.26,width*.22]);
  };
  function clothPanel(points: V[], color: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(),3));
    const indices: number[] = [];
    for(let j=0;j<points.length-2;j++) indices.push(0,j+1,j+2);
    geo.setIndex(indices); geo.computeVertexNormals(); add(geo,color,[0,0,0]);
  }

  switch (id) {
    case "rosette": {
      fluted(.34,.235,.153,.302,p.lining,12);
      fluted(.382,.172,.147,.29,p.cloth,12,.11);
      for(let i=0;i<8;i++) {
        const a=i*TAU/8;
        gem(p.lining,[.245*Math.sin(a),.31,.215*Math.cos(a)],[.031,.058,.025]);
      }
      ribbon([0,.448,.163],p.deep,.095);
      for(const s of [-1,1]) {
        tube(p.lining,[s*.081,.61,.126],[s*.01,.55,.14],.009);
        tube(p.metal,[s*.062,.534,.132],[-s*.052,.496,.144],.005);
        clothPanel([[s*.09,.432,.125],[s*.122,.433,.12],[s*.19,.249,.176],[s*.157,.261,.177]],p.deep);
        orb(p.hair,[s*.272,.81,-.041],[.074,.082,.075],s*.19);
        orb(p.hair,[s*.285,.71,-.029],[.052,.056,.052],s*.19);
      }
      gem(p.metal,[0,.563,.152],[.021,.027,.012]);
      for (const s of [-1,1]) {
        orb(p.cloth,[s*.175,.588,.01],[.079,.084,.081]);
        orb(p.hair,[s*.271,.976,-.08],[.094,.208,.102],s*.19);
        for(let j=0;j<3;j++) orb(j===1?p.cloth:p.deep,[s*(.19+j*.026),1.115-j*.022,.105],[.034,.031,.031]);
      }
      for(let j=-2;j<=2;j++) gem(p.metal,[j*.043,1.17+.03*(2-Math.abs(j)),.063],[.027,.046,.02]);
      break;
    }
    case "nocturne": {
      add(new THREE.ConeGeometry(1,1,5),p.deep,[-.087,.45,-.102],[.10,0,-.21],[.25,.46,.143]);
      clothPanel([[-.16,.62,.026],[-.22,.58,.028],[-.315,.232,-.012],[-.253,.255,-.102],[-.14,.37,-.115]],p.deep);
      tube(p.metal,[-.219,.575,.03],[-.314,.233,-.012],.009);
      tube(p.metal,[-.14,.609,.118],[.095,.512,.132],.007);
      gem(p.metal,[-.105,.603,.143],[.029,.032,.012]);
      for(const s of [-1,1]) orb(p.deep,[s*.10,.186,.027],[.076,.09,.083]);
      orb(p.lining,[-.159,.604,.023],[.105,.072,.106],-.15);
      fluted(.345,.17,.15,.207,p.cloth,5);
      for(let j=0;j<3;j++) gem(p.metal,[.035*j,.55-.042*j,.137],[.045,.027,.012]);
      orb(p.deep,[0,1.125,-.038],[.276,.104,.205]);
      gem(p.metal,[-.189,1.171,.114],[.046,.089,.027],.45);
      gem(p.lining,[-.23,1.222,.083],[.036,.103,.019],.69);
      tube(p.deep,[.26,.47,.058],[.30,.67,.055],.018);
      tube(p.metal,[.243,.635,.059],[.353,.617,.059],.016);
      gem(0xdce6ff,[.319,.809,.052],[.035,.188,.023],-.15);
      break;
    }
    case "coral": {
      fluted(.32,.268,.158,.258,p.lining,7);
      fluted(.37,.184,.155,.237,p.cloth,7,.35);
      tube(p.lining,[-.105,.635,.096],[.102,.42,.127],.027);
      ribbon([-.076,.421,.14],0xeb9e9c,.073);
      clothPanel([[-.09,.408,.135],[-.042,.41,.159],[-.092,.22,.17],[-.151,.244,.161]],0xe6a2a8);
      for(let j=0;j<4;j++) gem(p.lining,[.057+j*.036,.282+Math.sin(j)*.022,.172],[.016,.025,.011],j*.4);
      for (const s of [-1,1]) {
        orb(p.hair,[s*.257,.775,-.052],[.086,.225,.082],-s*.16);
        orb(p.hair,[s*.288,.61,-.015],[.058,.127,.050],s*.21);
        gem(p.metal,[s*.289,.527,-.012],[.028,.036,.024]);
      }
      for(let i=0;i<5;i++) {
        const a=(i-2)*.32;
        orb(p.lining,[.266+Math.sin(a)*.085,.652+Math.cos(a)*.05,.092],[.027,.077,.013],-a);
        tube(p.metal,[.266,.553,.095],[.266+Math.sin(a)*.115,.66+Math.cos(a)*.08,.092],.006);
      }
      for(let i=0;i<4;i++) gem(p.lining,[.167+i*.025,1.139+Math.sin(i)*.025,.141],[.029,.05,.019],-.5+i*.35);
      break;
    }
    case "orbit": {
      fluted(.355,.17,.158,.19,p.cloth,4);
      clothPanel([[-.131,.51,.102],[-.097,.51,.132],[-.133,.255,.125],[-.181,.28,.103]],p.deep);
      for(let i=0;i<6;i++) orb(p.metal,[.047+i*.019,.44-.024*Math.sin(i*Math.PI/5),.147-i*.009],[.008,.008,.007]);
      for(const s of [-1,1]) {
        tube(p.lining,[s*.113,.633,.113],[s*.032,.51,.146],.028);
        for(let j=0;j<3;j++) orb(p.metal,[s*.047,.476-j*.038,.149],[.014,.012,.009]);
      }
      orb(p.deep,[0,1.15,-.022],[.295,.137,.214],.10);
      orb(p.lining,[0,1.103,.121],[.269,.036,.161],.04);
      for(const s of [-1,1]) {
        orb(p.metal,[s*.08,1.16,.187],[.066,.049,.025]);
        orb(0x79b6c6,[s*.08,1.16,.209],[.048,.033,.009]);
      }
      tube(p.metal,[.237,.51,.083],[.337,.59,.221],.034,.05);
      orb(0x88d7ed,[.34,.596,.222],[.042,.032,.025]);
      break;
    }
    case "bamboo": {
      fluted(.34,.245,.132,.21,p.lining,6);
      fluted(.40,.195,.153,.184,p.cloth,6,.55);
      clothPanel([[-.06,.422,.138],[.005,.419,.154],[-.028,.19,.16],[-.094,.202,.135]],p.deep);
      for (const s of [-1,1]) {
        const y=s===1?.538:.404;
        add(new THREE.CylinderGeometry(.063,.079,.109,10),p.lining,[s*.219,y+.028,.047],[0,0,s*.43],[1,1,.90]);
      }
      tube(p.deep,[-.112,.626,.109],[.104,.428,.132],.022);
      for(let j=0;j<4;j++) gem(p.metal,[-.125+.018*j,.367-.029*j,.133],[.011,.022,.009],-.53);
      orb(p.deep,[.021,1.185,-.063],[.122,.093,.10]);
      tube(p.metal,[-.115,1.16,-.009],[.172,1.214,-.052],.011);
      gem(p.cloth,[.178,1.205,-.045],[.023,.046,.019]);
      tube(0x916f47,[.245,.42,.074],[.312,.779,.065],.016,.013);
      gem(0x3f514e,[.318,.811,.065],[.029,.068,.024],-.19);
      tube(p.lining,[-.266,.355,.063],[-.21,.473,.103],.036);
      break;
    }
  }
}
