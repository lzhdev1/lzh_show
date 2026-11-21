import { Color } from "three";
import { styles } from "./ranchSpecies";
import { isBird,type Wildlife } from "./wildlifeAnatomy";

const hex=(v:number)=>"#"+v.toString(16).padStart(6,"0");
const mix=(a:number,b:number,t:number)=>new Color(a).lerp(new Color(b),t).getHex();
export function paintAnimal(species:Wildlife){
  const tex=typeof OffscreenCanvas==="function"?new OffscreenCanvas(1024,1024):document.createElement("canvas");
  tex.width=tex.height=1024;
  const c=tex.getContext("2d",{willReadFrequently:true})!;
  const {fur,bib,pattern}=styles[species],bird=isBird(species),red=species==="redPanda";
  const raccoon=species==="raccoon",alpaca=species==="alpaca",duck=species==="duck",crane=species==="crane",penguin=species==="penguin";
  const amber=red?0x8a5734:raccoon?0xa18b5d:crane?0xa96933:0x76664b;
  let seed=Array.from(species).reduce((v,k)=>Math.imul(v,33)+k.charCodeAt(0),6219);
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function ellipse(x:number,y:number,rx:number,ry:number,color:number,tilt=0){
    c.fillStyle=hex(color);c.beginPath();c.ellipse(x,y,rx,ry,tilt,0,Math.PI*2);c.fill();
  }
  function patch(x:number,y:number,curves:number[][],col:number){
    c.fillStyle=hex(col);c.beginPath();c.moveTo(x,y);
    for(const [a,b,d,e,f,g] of curves)c.bezierCurveTo(a,b,d,e,f,g);
    c.closePath();c.fill();
  }
  function stroke(x:number,y:number,points:number[],color:number,width:number){
    c.lineWidth=width;c.strokeStyle=hex(color);c.lineCap="round";c.beginPath();c.moveTo(x,y);
    for(let j=0;j<points.length;j+=6)c.bezierCurveTo(points[j],points[j+1],points[j+2],points[j+3],points[j+4],points[j+5]);
    c.stroke();
  }
  c.scale(1024,1024);c.fillStyle=hex(fur);c.fillRect(0,0,1,1);
  c.save();c.translate(.015,.012);c.scale(.97/24,.626/24);
  for(const mirror of [false,true]){
    c.save();if(mirror){c.translate(0,24);c.scale(1,-1);}
    c.beginPath();c.rect(-1,-1,26,13.04);c.clip();
    const coat=c.createLinearGradient(0,0,0,12);
    coat.addColorStop(0,hex(mix(fur,pattern,.38)));coat.addColorStop(.32,hex(fur));
    coat.addColorStop(.62,hex(mix(fur,bib,.32)));coat.addColorStop(1,hex(bird&&penguin?bib:mix(fur,bib,.65)));
    c.fillStyle=coat;c.fillRect(-1,-1,26,14);
    if(raccoon||red){
      for(let i=0;i<5;i++){
        const x=-.46+i*.91;
        patch(x-.05,-.7,[[x+.23,3.72,x+.38,7.71,x-.41,12.74],[x+.05,12.78,x+.35,12.79,x+.42,12.76],
          [x+.90,8.15,x+.71,4.71,x+.49,-.7]],red?mix(fur,bib,.67):mix(pattern,fur,.17));
      }
      if(red)patch(3.86,13,[[5.61,8.44,7.21,7.58,9.49,8.20],[12.24,9,13.47,7.94,14.85,6.37],
        [15.77,7.65,16.29,9.70,18.08,12.72]],0x433332);
      else patch(4.10,-.6,[[6.51,.90,10.10,.56,13.79,1.12],[13.08,3.51,9.43,3.66,6.07,3.01],
        [4.63,2.15,4.01,1.1,4.10,-.6]],mix(fur,pattern,.46));
    }
    if(penguin){
      patch(2.43,12.8,[[4.61,9.17,6.75,5.32,11.54,4.62],[13.87,4.37,14.78,5.69,15.95,6.51],
        [17.70,7.72,18.14,9.93,20.3,12.65]],bib);
      patch(13.15,5.65,[[13.88,4.77,15.25,2.7,16.78,3.26],[17.37,3.78,17.32,5.05,16.85,5.75],
        [16.27,6.42,15.69,7.49,14.18,8.07],[14.57,7.04,13.87,6.54,13.15,5.65]],0xe7ad50);
    }
    if(duck){
      c.fillStyle="#d5c0a4";c.fillRect(8,0,5,13);
      patch(9.45,12.8,[[11.29,8.91,12.48,4.26,12.51,-.5],[13.11,-.5,15.84,-.5,16.05,-.5],
        [16.50,5.1,16.39,8.9,15.91,12.7]],0x844c38);
      c.fillStyle="#f4e8cd";c.fillRect(14.21,-.64,.66,13.4);
      const head=c.createLinearGradient(14,1,21,8);head.addColorStop(0,"#244e40");head.addColorStop(.35,"#467458");
      head.addColorStop(.64,"#234d51");head.addColorStop(1,"#3f6568");
      c.fillStyle=head;c.fillRect(14.82,-.64,6.09,13.4);
    }
    if(crane){
      patch(12.80,12.50,[[13.40,7.33,13.91,3.23,15.47,2.30],[16.69,1.53,18.28,2.33,20.82,3.07],
        [21.12,6.87,21.60,9.23,21.84,12.70]],pattern);
      patch(16.2,3.19,[[17.43,2.91,18.50,3.05,20.11,4.06],[19.81,4.43,18.74,4.90,17.81,5.23],
        [16.63,6.37,16.35,7.41,15.65,7.93]],bib);
      ellipse(17.9,-.10,1.01,1.62,0x9b3330);
    }
    if(!bird){
      const ex=18.07,ey=4.49;
      if(raccoon){
        patch(15.66,4.31,[[16.39,3.6,17.64,3.23,18.57,3.32],[19.61,3.37,20.12,3.81,21.17,5.32],
          [21.63,5.95,21.13,6.35,20.55,6.21],[19.46,5.93,18.37,5.64,17.46,5.83],[16.69,5.82,16.17,5.67,15.66,4.31]],pattern);
        stroke(15.57,3.56,[16.85,2.76,18.40,2.65,19.80,3.36],bib,.30);
      }else if(red){
        patch(15.98,6.48,[[16.86,6.25,17.94,5.43,18.67,4.91],[18.40,5.96,18.39,6.52,18.99,7.10],
          [18.89,8.56,17.6,9.01,16.22,9.06],[16.88,8.05,16.69,7.42,15.98,6.48]],bib);
        ellipse(18.12,2.88,.73,.38,bib,-.19);
      }else{
        patch(17.4,-.4,[[17.0,1.22,17.84,2.16,18.36,2.67],[19.22,3.07,19.38,4.15,20.19,5.33],
          [20.21,4.15,20.54,2.95,21.04,1.92],[21.1,.63,21.43,-.2,21.54,-.48]],bib);
      }
      // Soft black eye rim with a dark iris. No scleral white or cartoon brow.
      c.save();c.translate(ex,ey);c.rotate(-.17);
      ellipse(0,0,alpaca?.58:.66,alpaca?.38:.55,mix(pattern,0x23212a,.60));
      ellipse(.035,.017,alpaca?.40:.41,alpaca?.32:.41,amber);
      ellipse(.033,-.015,.244,.239,0x201e21);
      ellipse(-.105,-.094,.069,.051,0xe0e2d7);ellipse(.17,.10,.034,.025,0xac956b);
      stroke(-.60,-.04,[-.30,-.43,.24,-.40,.61,-.077],0x29262b,.068);
      c.restore();
      if(!raccoon)stroke(ex-.66,ey-.48,[ex-.23,ey-.64,ex+.25,ey-.63,ex+.68,ey-.42],mix(pattern,fur,.42),.115);
      if(!alpaca){
        patch(21.1,11.5,[[21.54,9.29,21.40,7.11,20.94,6.22],[21.43,5.69,22.17,5.25,22.63,4.88],
          [23.24,6.12,23.65,9.35,24.7,12.61]],mix(fur,bib,.92));
      }
      patch(23.0,-.7,[[22.83,1.83,22.98,4.58,23.25,5.86],[23.41,6.80,23.80,7.37,24.8,8.0],
        [25,5.54,25,1.35,25,-.7]],0x38363a);
      stroke(23.37,3.68,[23.56,3.81,23.74,4.17,23.80,4.54],0x25232a,.142);
      stroke(20.86,8.30,[21.80,9.04,22.58,9.22,23.30,10.62],mix(pattern,bib,.34),.093);
    }else{
      const eyeX=crane?18.40:18.16;
      ellipse(eyeX,4.39,.53,.60,mix(fur,pattern,.53));ellipse(eyeX+.03,4.35,.39,.43,amber);
      ellipse(eyeX+.055,4.30,.273,.33,0x211e20);ellipse(eyeX-.04,4.15,.080,.090,0xfaeacb);
      const bill=duck?0xc6aa55:penguin?0x373942:0x586851;
      c.fillStyle=hex(bill);c.fillRect(20.06,-.6,4.96,13.25);
      stroke(20.75,6.01,[21.71,5.95,22.88,5.93,24.42,6.38],mix(bill,0x161b24,.58),.17);
      if(penguin)stroke(20.85,7.1,[21.63,7.4,22.38,7.0,23.60,6.5],0xc18d60,.40);
      if(duck)ellipse(21.47,2.65,.22,.31,0x927a43);
    }
    // Directional fibres change angle around the ribs and flow down the neck.
    for(let i=0;i<14500;i++){
      const x=rand()*24,y=rand()*12.02;
      if(x>17.35&&x<19.42&&y>3.02&&y<5.34||x>22.9)continue;
      const tail=x<4.7,neck=x>12.6&&x<17.3;
      const len=(bird?.045:alpaca?.18:.14)*(tail?1.55:neck?1.34:1)*(.45+rand());
      const dy=(neck?1:tail?.18:.55+Math.cos(x*.49+y*.26)*.36)*(rand()*.42+.56)*len;
      const dx=-len*(tail?1.73:1);
      c.globalAlpha=(bird?.15:.245)*(.28+rand());
      stroke(x,y,[x+dx*.38,y-dy*.14,x+dx*.69,y+dy*.43,x+dx,y+dy],i%3?bib:pattern,.013+rand()*.020);
    }
    c.globalAlpha=1;c.restore();
  }
  c.restore();
  const foot=bird?(crane?0x46463e:duck?0xcf7839:0x403c39):alpaca?0x775f51:0x343031;
  for(const [kind,x,w] of [["leg",.015,.253],["ear",.284,.159],["wing",.466,.142]] as const){
    c.save();c.translate(x,.66);c.scale(w,.28);
    const g=c.createLinearGradient(0,0,0,1);
    g.addColorStop(0,hex(kind==="leg"&&red?pattern:fur));
    g.addColorStop(.64,hex(kind==="leg"?(bird?foot:red?pattern:mix(fur,foot,.30)):kind==="wing"?mix(fur,pattern,.48):mix(fur,bib,.34)));
    g.addColorStop(1,hex(kind==="leg"?foot:kind==="ear"?bib:pattern));
    c.fillStyle=g;c.fillRect(-.025,-.025,1.05,1.05);
    if(kind==="ear"){
      for(const x of [.23,.76]){
        ellipse(x,.56,.183,.335,bib);
        ellipse(x,.55,.133,.255,mix(fur,0xb28e86,.49));
        ellipse(x,.60,.084,.177,mix(pattern,0xbb9a89,.54));
      }
    }else if(kind==="wing"){
      if(duck){c.fillStyle="#264d65";c.fillRect(-.01,.48,1.03,.28);
        for(const y of [.45,.77]){c.fillStyle="#eee8d4";c.fillRect(-.01,y,1.03,.031);}}
      for(let j=-1;j<=11;j++){
        const x=j*.108;
        stroke(x,0,[x-.018,.36,x+.13,.65,x+.09,1],mix(pattern,fur,.23),.013);
        stroke(x+.017,0,[x+.009,.34,x+.16,.64,x+.106,.97],mix(bib,fur,.40),.007);
      }
    }else if(bird){
      for(let i=0;i<23;i++)stroke(0,i/22,[.28,i/22+.008,.71,i/22-.011,1,i/22],mix(foot,0x383038,.48),.008);
    }else for(let i=0;i<1600;i++){
      const x=rand(),y=rand();c.globalAlpha=.12+rand()*.12;
      stroke(x,y,[x+.003,y+.002,x+.004,y+.016,x+.009,y+.023],i%4?bib:foot,.002);
    }
    c.globalAlpha=1;c.restore();
  }
  const chips=[[.135,0xe6d7b4],[.245,0xc79b61],[.355,0x845b44],[.465,0x779c94],[.575,0xc1d4c4],
    [.667,bib],[.742,mix(fur,pattern,.33)],[.772,duck?0x36454a:crane?pattern:foot],[.795,mix(fur,bib,.55)],
    [.819,bird?mix(pattern,fur,.38):fur],[.845,foot],[.875,0xfff5dc],[.894,amber],[.929,0x1e2024],[.943,0x363437]];
  for(const [u,col] of chips){c.fillStyle=hex(col);c.fillRect(u-.009,.963,.018,.036);}
  c.save();c.translate(.015,.012);c.scale(.97/24,.626/24);c.globalCompositeOperation="destination-out";c.globalAlpha=.68;
  for(const mirror of [false,true]){
    c.save();if(mirror){c.translate(0,24);c.scale(1,-1);}
    stroke(5.87,4.2,[7.16,3.62,7.51,6.34,8.71,5.91,9.72,5.48,10.53,3.69,12.30,4.29],0,.077);
    for(let i=0;i<6;i++)ellipse(6+i*1.13,4.22+Math.sin(i*.96),.081,.164,0,.18);
    c.restore();
  }
  c.restore();return tex;
}
