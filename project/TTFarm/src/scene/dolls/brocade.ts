import type { Spirit } from "../../game/weather";

// The bottom band of the shared face atlas wraps once around a skirt/coat.
// Keep a one-pixel painted border for mip sampling.
export const brocadeUV: [number,number,number,number] = [.153,.028,.977,.201];
const silk: Record<Spirit,[string,string,string,string]> = {
  rosette:["#f7c7cf","#dc769a","#fff1ca","#ae4c74"],
  nocturne:["#38456e","#27284e","#dddeef","#8a90c8"],
  coral:["#c0e5e1","#71bbcb","#fff0cb","#528fa7"],
  orbit:["#cb9870","#89624c","#ffe4a0","#394c69"],
  bamboo:["#b2cfc0","#74a394","#fff2cd","#426e67"],
};

export function paintDollBrocade(canvas:HTMLCanvasElement,id:Spirit) {
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.save();
  ctx.translate(canvas.width*.15,canvas.height*(1-.205));
  ctx.scale(canvas.width*.83/424,canvas.height*.18/92);
  ctx.beginPath();ctx.rect(0,0,424,92);ctx.clip();
  const [top,bottom,gold,ink]=silk[id];
  const base=ctx.createLinearGradient(0,0,0,92);
  base.addColorStop(0,top);base.addColorStop(.69,bottom);base.addColorStop(1,top);
  ctx.fillStyle=base;ctx.fillRect(0,0,424,92);
  ctx.lineCap="round";ctx.lineJoin="round";
  function draw(d:string,color:string,width=1,fill=false){
    const path=new Path2D(d);
    if(fill){ctx!.fillStyle=color;ctx!.fill(path);}
    else {ctx!.strokeStyle=color;ctx!.lineWidth=width;ctx!.stroke(path);}
  }
  function dot(x:number,y:number,r:number,color:string){
    ctx!.beginPath();ctx!.arc(x,y,r,0,2*Math.PI);ctx!.fillStyle=color;ctx!.fill();
  }
  function star(x:number,y:number,r:number) {
    ctx!.save();ctx!.translate(x,y);ctx!.scale(r,r);
    draw("M0 -1 Q.12 -.16 .7 0 Q.12 .12 0 1 Q-.10 .15 -.7 0 Q-.09 -.13 0 -1Z",gold,.1,true);
    ctx!.restore();
  }
  const rose="M-6 0 Q-10 -5 -4 -8 Q-2 -12 3 -8 Q9 -9 9 -3 Q13 2 7 5 Q7 10 1 9 Q-4 12 -6 6 Q-12 5 -6 0Z";
  for(let tile=-1;tile<9;tile++){
    ctx.save();ctx.translate(26.5+tile*53,0);
    switch(id){
      case "rosette":
        draw("M-27 60 C-16 70 -12 70 0 55 S18 38 28 43",ink,1.6);
        draw("M-15 65 Q-16 56 -22 56 Q-21 64 -15 65 M11 46 Q8 38 12 34 Q16 40 11 46",gold,1.2,true);
        ctx.save();ctx.translate(0,55);ctx.scale(.73,.73);draw(rose,gold,1.7);
        draw("M-5 3 Q-7 -3 -2 -5 Q5 -7 6 0 Q5 7 -2 5 Q-7 1 -1 -1 Q3 -2 2 2",gold,1.7);ctx.restore();
        star(20,30,2.5);
        break;
      case "nocturne":
        draw("M-27 54 L-14 39 L2 51 L14 31 L26 44",ink,1.2);
        for(const [x,y] of [[-14,39],[2,51],[14,31]]){dot(x,y,2.2,gold);dot(x,y,.9,"#fff");}
        draw("M-5 59 A11 11 0 1 0 9 74 A9 9 0 0 1 -5 59Z",gold,1,true);
        star(19,61,4);break;
      case "coral":
        for(let row=0;row<2;row++){
          ctx.save();ctx.translate(row*13,64-row*14);
          for(let x=-27;x<=27;x+=26){
            for(const r of [13,9,5])draw(`M${x-r} 0 A${r} ${r} 0 0 1 ${x+r} 0`,row?ink:gold,row?.9:1.15);
          }
          ctx.restore();
        }
        dot(8,27,2,"#fff2d4");dot(12,20,1.5,gold);star(-17,30,3.5);
        break;
      case "orbit":
        draw("M-27 49 L-15 38 L-1 53 L10 35 L27 43",gold,1.1);
        for(const [x,y] of [[-15,38],[-1,53],[10,35]])star(x,y,3.7);
        ctx.save();ctx.translate(3,62);ctx.rotate(-.36);
        ctx.beginPath();ctx.ellipse(0,0,13,4,0,0,Math.PI*2);ctx.strokeStyle=ink;ctx.lineWidth=1.3;ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.strokeStyle=gold;ctx.stroke();ctx.restore();
        break;
      case "bamboo":
        draw("M-15 74 Q-4 59 11 33 M-8 65 Q-15 58 -21 55 M-2 56 Q8 55 19 47 M4 45 Q-2 41 -8 35",ink,1.6);
        draw("M9 39 Q16 36 17 27 Q12 30 9 39Z M5 47 Q12 45 19 38 Q11 40 5 47Z M-3 55 Q-7 44 -14 41 Q-11 50 -3 55Z M-7 62 Q5 62 12 54 Q1 57 -7 62Z",ink,.8,true);
        draw("M-18 66 Q-23 61 -24 56 M3 50 Q11 48 15 44",gold,1.2);break;
    }
    ctx.restore();
  }
  draw("M0 8 H424 M0 80 H424",gold,1.7);
  draw("M0 84 H424",ink,1.3);
  ctx.setLineDash([2,3]);draw("M0 76 H424",gold,1);ctx.setLineDash([]);
  ctx.restore();
}
