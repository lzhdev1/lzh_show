import * as T from "three";

/** The bundled VRoid body is cut away underneath its original T-shirt.
 * Rebuild the exposed décolletage with the same toon material and shoulder skin UV. */
export function fitCoutureSkin(body:T.SkinnedMesh) {
  const original=body.geometry, skin=original.clone();
  const source=original.index!, p=original.getAttribute("position"), uv=original.getAttribute("uv");
  const keep:number[]=[];
  const groups=original.groups.length?original.groups:[{start:0,count:source.count,materialIndex:0}];
  const enclosed=(i:number)=>{
    const y=p.getY(i);
    return y<.065 || (y>.832 && y<1.19 && Math.abs(p.getX(i))<.18);
  };
  skin.clearGroups();
  for(const group of groups){
    const start=keep.length;
    for(let i=group.start;i<group.start+group.count;i+=3){
      const a=source.getX(i), b=source.getX(i+1), c=source.getX(i+2);
      if(!enclosed(a)||!enclosed(b)||!enclosed(c))keep.push(a,b,c);
    }
    skin.addGroup(start,keep.length-start,group.materialIndex);
  }
  // Triangles crossing the shoe opening stay in place at the ankle and
  // taper inside the narrower heel cups below it, even when the foot rolls.
  const fitted=skin.getAttribute("position");
  for(let i=0;i<fitted.count;i++){
    const y=p.getY(i);
    if(y>=.091)continue;
    const axis=p.getX(i)<0?-.077:.077;
    const scale=.68+.32*T.MathUtils.smoothstep(y,.059,.091);
    fitted.setXYZ(i,axis+(p.getX(i)-axis)*scale,y,-.033+(p.getZ(i)+.033)*scale);
  }
  fitted.needsUpdate=true;
  skin.setIndex(keep); body.geometry=skin;

  let sample=0, closest=Infinity;
  for(let i=0;i<p.count;i++){
    const d=(p.getX(i)-.081)**2+(p.getY(i)-1.288)**2+(p.getZ(i)-.012)**2;
    if(d<closest){sample=i;closest=d;}
  }
  const positions:number[]=[], uvs:number[]=[], indices:number[]=[], weights:number[]=[], joints:number[]=[];
  const skeleton=body.skeleton;
  const upper=skeleton.bones.findIndex(b=>b.name==="J_Bip_C_UpperChest");
  const chest=skeleton.bones.findIndex(b=>b.name==="J_Bip_C_Chest");
  const neck=skeleton.bones.findIndex(b=>b.name==="J_Bip_C_Neck");
  const profile=[
    // Height, half-width, front depth, rear depth (torso centre is behind the hips).
    [1.154,.124,.103,.069], [1.186,.132,.108,.07], [1.216,.136,.095,.068],
    [1.24,.14,.076,.066], [1.268,.145,.054,.065], [1.284,.139,.043,.063],
    [1.296,.117,.034,.061], [1.305,.084,.025,.059], [1.315,.051,.019,.054],
    [1.337,.042,.015,.050],
  ];
  const n=48;
  for(const [j,[y,w,front,back]] of profile.entries()){
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n, cos=Math.cos(a);
      positions.push(w*Math.sin(a),y,cos*(cos>=0?front:back));
      uvs.push(uv.getX(sample),uv.getY(sample));
      const high=T.MathUtils.smoothstep(y,1.30,1.35);
      const mid=T.MathUtils.smoothstep(y,1.07,1.21);
      joints.push(chest,upper,neck,0); weights.push(1-mid,mid*(1-high),mid*high,0);
      if(j){const k=(j-1)*n+i,next=(j-1)*n+(i+1)%n; indices.push(k,next,k+n,next,next+n,k+n);}
    }
  }
  const g=new T.BufferGeometry(); g.setIndex(indices);
  g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(uvs,2));
  g.setAttribute("skinIndex",new T.Uint16BufferAttribute(joints,4));
  g.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4)); g.computeVertexNormals();
  const m=Array.isArray(body.material)?body.material[0]:body.material;
  const insert=new T.SkinnedMesh(g,m);
  insert.name="Neckline"; insert.bind(skeleton,body.bindMatrix); insert.frustumCulled=false;
  body.parent!.add(insert);
  return ()=>{ insert.removeFromParent(); g.dispose(); body.geometry=original; skin.dispose(); };
}
