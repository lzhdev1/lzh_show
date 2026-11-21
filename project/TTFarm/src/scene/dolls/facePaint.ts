import type { Spirit } from "../../game/weather";
import { paintDollBrocade } from "./brocade";

// Colours are specified as the unlit pigment on the porcelain skin.
export const complexions: Record<Spirit,string> = {
  rosette:"#ffdac7", nocturne:"#f6d0b8", coral:"#ffe0cd", orbit:"#f0c2a9", bamboo:"#f6d5bb",
};

interface Eyes {
  ink:string; brow:string; limbus:string; iris:string; jewel:string;
  width:number; height:number; tilt:number; level:number; gaze:number;
}
const eyes:Record<Spirit,Eyes> = {
  rosette:{ink:"#47313a",brow:"#935568",limbus:"#3b3f29",iris:"#8a8d46",jewel:"#f6d58e",width:.058,height:.044,tilt:.10,level:.928,gaze:.03},
  nocturne:{ink:"#302c40",brow:"#514768",limbus:"#332a4b",iris:"#7d69ae",jewel:"#d3b5f5",width:.060,height:.035,tilt:.21,level:.928,gaze:-.06},
  coral:{ink:"#383d49",brow:"#508c91",limbus:"#234d63",iris:"#429ca6",jewel:"#aff5e1",width:.058,height:.045,tilt:.04,level:.926,gaze:.04},
  orbit:{ink:"#4c3330",brow:"#845439",limbus:"#31445c",iris:"#4775a1",jewel:"#a8deeb",width:.060,height:.040,tilt:.10,level:.929,gaze:.09},
  bamboo:{ink:"#343934",brow:"#456152",limbus:"#293e36",iris:"#658678",jewel:"#d6dab1",width:.059,height:.036,tilt:.06,level:.928,gaze:-.04},
};

type Ctx = CanvasRenderingContext2D;
function oval(ctx:Ctx,x:number,y:number,rx:number,ry:number,color:string) {
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}
function glaze(ctx:Ctx,x:number,y:number,rx:number,ry:number,colour:string) {
  ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
  const wash=ctx.createRadialGradient(0,0,0,0,0,1);
  wash.addColorStop(0,colour);wash.addColorStop(1,colour.slice(0,7)+"00");
  ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);ctx.restore();
}
function brush(ctx:Ctx,stroke:string,width:number,path:Path2D) {
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(path);
}
function enamelEye(ctx:Ctx,id:Spirit,side:number) {
  const p=eyes[id], longLashes=id==="rosette"||id==="coral";
  ctx.save();ctx.translate(side*.100,p.level);ctx.scale(side*p.width,p.height);
  // The white of the eye, iris, and pupils share the same lid aperture.
  // Extending the iris under the upper lash avoids a startled, round-eyed look.
  const t=p.tilt;
  const aperture=new Path2D();
  aperture.moveTo(-1,-.09);
  aperture.bezierCurveTo(-.79,.70,-.38,.94,.04,.92);
  aperture.bezierCurveTo(.47,.92,.79,.69,1,.17+t);
  aperture.bezierCurveTo(.74,-.35+t,.43,-.79,-.01,-.79);
  aperture.bezierCurveTo(-.45,-.80,-.80,-.59,-1,-.09);
  aperture.closePath();
  const ivory=ctx.createLinearGradient(0,1,0,-.8);
  ivory.addColorStop(0,"#c4aeb7");ivory.addColorStop(.36,"#f2e2df");ivory.addColorStop(.8,"#fff7eb");
  ctx.fillStyle=ivory;ctx.fill(aperture);
  ctx.save();ctx.clip(aperture);ctx.translate(side*p.gaze,0);
  ctx.beginPath();ctx.ellipse(-.04,.13,.64,1,0,0,Math.PI*2);ctx.clip();
  const lens=ctx.createLinearGradient(0,1,0,-.82);
  lens.addColorStop(0,p.ink);lens.addColorStop(.34,p.limbus);lens.addColorStop(.70,p.iris);lens.addColorStop(1,p.jewel);
  ctx.fillStyle=lens;ctx.fillRect(-1,-1,2,2);
  ctx.strokeStyle=p.limbus;ctx.lineWidth=.065;ctx.beginPath();ctx.ellipse(-.04,.13,.628,.987,0,0,2*Math.PI);ctx.stroke();
  ctx.save();ctx.globalAlpha=.49;
  for(let i=0;i<14;i++) {
    const a=Math.PI*(1.08+.83*i/13),x=Math.cos(a),y=Math.sin(a);
    const ray=new Path2D();ray.moveTo(-.04+x*.41,.13+y*(.59+.07*Math.cos(i*5)));
    ray.quadraticCurveTo(-.03+x*.48,.13+y*.77,-.04+x*.54,.13+y*.86);
    brush(ctx,p.jewel,.022,ray);
  }
  ctx.restore();
  oval(ctx,-.045,.21,.238,.54,p.limbus);
  oval(ctx,-.045,.31,.19,.37,p.ink);
  // Reflections face the same light source in both eyes.
  const lit=-.04-side*.225;
  oval(ctx,lit,.52,.17,.197,"#fff8eb");
  oval(ctx,lit+side*.21,.71,.065,.064,"#fffef4");
  oval(ctx,-.04+side*.26,-.32,.067,.085,p.jewel);
  oval(ctx,-.04+side*.19,-.46,.043,.050,"#fff2d8");
  ctx.restore();
  const lashes=new Path2D();
  lashes.moveTo(-1.025,-.08);
  lashes.bezierCurveTo(-.76,.71,-.36,1.10,.09,1.04);
  lashes.bezierCurveTo(.5,1.05,.78,.79,1.01,.32+t);
  lashes.quadraticCurveTo(1.13,.42+t,longLashes?1.22:1.13,longLashes?.54+t:.39+t);
  lashes.quadraticCurveTo(1.09,.17+t,.90,-.05+t);
  lashes.bezierCurveTo(.73,.46+t,.41,.77,.04,.79);
  lashes.bezierCurveTo(-.41,.82,-.77,.47,-1.025,-.08);
  ctx.fillStyle=p.ink;ctx.fill(lashes);
  if(longLashes){
    const tips=new Path2D();
    tips.moveTo(.74,.61+t);tips.quadraticCurveTo(.90,.80+t,.90,1.00+t);tips.quadraticCurveTo(.97,.78+t,.86,.46+t);
    tips.moveTo(.89,.44+t);tips.quadraticCurveTo(1.10,.65+t,1.12,.82+t);tips.quadraticCurveTo(1.15,.56+t,.96,.26+t);
    ctx.fill(tips);
  }
  const lower=new Path2D();
  lower.moveTo(.94,.07+t);lower.quadraticCurveTo(.77,-.39+t,.44,-.62);
  brush(ctx,"#956b67",.049,lower);
  const softLid=new Path2D();
  softLid.moveTo(-.59,1.02);softLid.quadraticCurveTo(-.02,1.36,.51,1.04+t);
  brush(ctx,"#b784791f",.075,softLid);
  // Individually drawn brows: the knight's brow descends toward the nose.
  const brow=new Path2D(), start=id==="nocturne"?1.29:id==="bamboo"?1.52:1.62;
  const asym=id==="orbit"&&side===-1?.22:0;
  brow.moveTo(-.81,start+asym);brow.bezierCurveTo(-.55,1.78+asym,.05,1.98+asym,.91,1.59+t+asym);
  brow.bezierCurveTo(.10,1.87+asym,-.40,1.62+asym,-.68,start-.07+asym);brow.quadraticCurveTo(-.79,start-.11+asym,-.81,start+asym);
  ctx.fillStyle=p.brow;ctx.fill(brow);
  ctx.restore();
}

function lipPaint(ctx:Ctx,id:Spirit) {
  const y=id==="orbit"?.810:.807;
  glaze(ctx,0,y-.005,.043,.018,"#d67b7650");
  if(id==="coral"){
    const smile=new Path2D();
    smile.moveTo(-.031,y+.007);smile.quadraticCurveTo(-.002,y-.002,.030,y+.009);
    smile.bezierCurveTo(.023,y-.009,.013,y-.023,-.002,y-.023);
    smile.quadraticCurveTo(-.018,y-.021,-.031,y+.007);
    ctx.fillStyle="#955d60";ctx.fill(smile);
    ctx.save();ctx.clip(smile);oval(ctx,.002,y-.023,.019,.009,"#eb9d94");ctx.restore();
  } else {
    const smile=new Path2D(),w=id==="bamboo"?.025:id==="orbit"?.035:.030;
    smile.moveTo(-w,y+.004);smile.bezierCurveTo(-w*.47,y+.001,-.007,y-.006,0,y-.005);
    smile.quadraticCurveTo(w*.53,y-.004,w,y+(id==="nocturne"?.002:id==="orbit"?.012:.007));
    brush(ctx,"#915d59",.0027,smile);
  }
  const glint=new Path2D();glint.moveTo(-.010,y-.013);glint.quadraticCurveTo(0,y-.016,.009,y-.013);
  if(id!=="coral")brush(ctx,"#ffebe08c",.0022,glint);
}

export function paintDollAtlas(id:Spirit) {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=512;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="#fff";ctx.fillRect(0,0,512,512);
  ctx.fillStyle=complexions[id];ctx.fillRect(0,0,512,402);
  ctx.save();
  // In this chart the drawing units are metres. Front-facing UVs share the
  // skull's lateral projection, so eyelashes turn with the temple in profile.
  ctx.translate(256,512*(1-.245));ctx.scale(512*.4375/.255,-512*.735/.51);ctx.translate(0,-.69);
  glaze(ctx,0,.944,.192,.160,"#fff2e438");
  for(const s of [-1,1]){
    glaze(ctx,s*.159,.862,.074,.036,id==="orbit"?"#d576645c":"#e783885c");
    glaze(ctx,s*.126,.89,.060,.017,"#c9877d38");
    glaze(ctx,s*.10,.972,.06,.026,"#c98a8d2a");
    enamelEye(ctx,id,s);
    if(id==="orbit")for(let i=0;i<5;i++) {
      oval(ctx,s*(.124+.0105*i),.861+.006*Math.sin(i*2+s),i%2?.0014:.0019,.0015,"#aa735f9e");
    }
  }
  glaze(ctx,-.002,.858,.022,.012,"#df958155");
  const nose=new Path2D();nose.moveTo(.003,.856);nose.quadraticCurveTo(.009,.852,.014,.856);
  brush(ctx,"#bb8d807d",.0024,nose);
  glaze(ctx,-.004,.865,.008,.004,"#fff0da70");
  if(id==="bamboo")oval(ctx,.144,.868,.0023,.0024,"#856c5b");
  lipPaint(ctx,id);ctx.restore();
  paintDollBrocade(canvas,id);
  return canvas;
}
