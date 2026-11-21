import type { V } from "./geometry";
import type { Tailor } from "./tailoring";

const brass = 0xe6bd72;

export function sword(t:Tailor) {
  const guard:V=[.241,.415,.119], tip:V=[.358,.715,.119];
  t.shaped([[.215,.35,.119,.011],[.219,.359,.119,.015],[.239,.408,.119,.013],[...guard,.017]],0x514064);
  t.gem([.214,.346,.119],[.016,.018,.013],brass);
  t.stitch([[.202,.425,.119],[.215,.432,.120],guard,[.268,.400,.120],[.280,.406,.119]],.007,brass);
  const blade:V[][]=[[.242,.419,.016],[.263,.457,.020],[.334,.653,.013],[tip[0],tip[1],.0007]].map(([x,y,w])=>
    [[x-w,y+.35*w,.119],[x,y,.132],[x+w,y-.35*w,.119],[x,y,.111],[x-w,y+.35*w,.119]]);
  t.satin(blade,0xd6e6ef);
  t.gem([guard[0],guard[1],.134],[.014,.019,.007],0x9891ec);
}

export function shellFan(t:Tailor) {
  const origin:V=[.225,.478,.133], start=-.67, spread=2.10, ribs=9;
  function at(angle:number,r:number,z:number):V {
    return [origin[0]+Math.sin(angle)*r,origin[1]+Math.cos(angle)*r,z];
  }
  for(let i=0;i<ribs;i++) {
    const a=start+spread*i/ribs, b=start+spread*(i+1)/ribs, mid=(a+b)/2;
    const edges=[a,mid,b];
    const panels=[.025,.069,.117,.138].map((r,k)=>edges.map((angle,j)=>
      at(angle,r*(1+.04*Math.cos(3*angle))+(k===3&&j===1?.013:0),.139+(j===1 && k>0?.012:0))));
    t.satin(panels,i%2?0x96ddda:0xc0ebe4);t.stitch(panels[3],.0028,0xffdaac,2);
    t.stitch([origin,panels[3][0]],.0023,brass,1);
  }
  t.stitch([at(.35,-.035,.14),origin],.009,brass);
  t.bead([origin[0],origin[1],.150],[.011,.011,.006],0xffd4bd);
  t.stitch([[.217,.456,.143],[.209,.43,.147],[.216,.408,.143]],.0025,0xc87073);
  t.shaped([[.216,.409,.143,.003],[.216,.402,.143,.007],[.219,.386,.144,.005]],0xe18d8a,7);
}

export function compass(t:Tailor) {
  const x=.226,y=.543,z=.166;
  t.bead([x,y,z],[.059,.064,.017],0xaf793c,-.18);
  t.bead([x,y,z+.013],[.051,.054,.011],0xffd892,-.18);
  t.bead([x,y,z+.022],[.043,.047,.007],0x335d70,-.18);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    t.stitch([[x+.036*Math.sin(a),y+.040*Math.cos(a),z+.027],
      [x+.041*Math.sin(a),y+.045*Math.cos(a),z+.027]],.002,0xf7dda8,1);
  }
  t.gem([x+.006,y+.008,z+.031],[.007,.031,.004],0xf8b783,-.55);
  t.gem([x-.006,y-.008,z+.031],[.006,.023,.004],0xe8e7d1,-.55);
  t.bead([x,y,z+.035],[.005,.005,.003],brass);
  t.stitch([[x-.012,y+.061,z],[x-.017,y+.076,z],[x-.006,y+.082,z],[x+.003,y+.074,z],[x+.002,y+.063,z]],.004,brass);
}

export function brushes(t:Tailor) {
  t.shaped([[.194,.413,.137,.004],[.208,.451,.137,.007],[.276,.622,.137,.008],[.28,.639,.137,.009]],0x785238,9);
  t.shaped([[.276,.622,.137,.009],[.281,.64,.137,.011]],brass,10);
  t.shaped([[.281,.639,.137,.009],[.285,.652,.137,.013],[.292,.674,.137,.009],[.295,.689,.137,.0008]],0x344a48,10);
  const paper:V[][]=[[-.31,.484,.120],[-.272,.467,.143],[-.234,.462,.152],[-.19,.474,.146],[-.164,.480,.128]].map(([x,y,z])=>
    [[x,y+.01,z],[x,y-.019,z+.004],[x-.007,y-.069,z+.006],[x-.012,y-.11,z+.013]]);
  t.satin(paper,0xf3e2b6);
  for(const i of [0,4]){
    const row=paper[i], a=row[0],b=row[3];
    t.shaped([[...a,.009],[...b,.010]],0xcfaa72,8);
    t.stitch([[a[0],a[1]+.012,a[2]],[b[0],b[1]-.012,b[2]]],.004,0x795537,2);
  }
  t.stitch([[-.292,.420,.151],[-.274,.432,.153],[-.26,.427,.160],[-.238,.443,.157],[-.216,.423,.158],[-.202,.432,.154],[-.18,.415,.15]],.0025,0x738e7c,7);
  t.stitch([[-.283,.403,.157],[-.263,.409,.161],[-.241,.406,.159],[-.215,.415,.161],[-.197,.410,.155]],.0018,0x8fa894,4);
  t.gem([-.203,.386,.158],[.005,.006,.002],0xb85e4a);
}
