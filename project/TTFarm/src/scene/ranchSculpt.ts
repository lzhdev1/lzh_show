import * as THREE from "three";

export type Point = [number, number, number];
type UV = [number, number];
export type Weights = [number, number][];
interface Vertex { p: THREE.Vector3; weights: Weights; glow: number }
interface Face { ids:number[]; uv:UV[] }
const avgUV = (a:UV,b:UV):UV => [(a[0]+b[0])*.5,(a[1]+b[1])*.5];
function mixWeights(vertices:Vertex[]):Weights {
  const sums = new Map<number,number>();
  for(const v of vertices) for(const [id,w] of v.weights) sums.set(id,(sums.get(id)??0)+w);
  const top = Array.from(sums).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const sum=top.reduce((s,v)=>s+v[1],0);
  return top.map(([id,w])=>[id,w/sum]);
}

/** Connected subdivision cage. Limb sockets share the actual body vertices around each opening. */
export class Sculpt {
  vertices:Vertex[]=[];
  faces:Face[]=[];
  point(at:Point, weights:Weights,glow=0) {
    return this.vertices.push({p:new THREE.Vector3(...at),weights,glow})-1;
  }
  quad(ids:number[],uv:UV[]) { this.faces.push({ids,uv}); }
  surface() {
    const verts=this.vertices.slice(), edgeIndex=new Map<string,number>();
    const edges:{ends:number[];faces:number[];id:number}[]=[];
    const neighborEdges:number[][]=verts.map(()=>[]);
    const neighborFaces:number[][]=verts.map(()=>[]);
    const centers:number[]=[], faceEdges:number[][]=[];
    const blended=(ids:number[])=>{
      const items=ids.map(i=>verts[i]);
      const p=items.reduce((v,i)=>v.add(i.p),new THREE.Vector3()).multiplyScalar(1/items.length);
      return {p,weights:mixWeights(items),glow:items.reduce((s,i)=>s+i.glow,0)/items.length};
    };
    for(const [fi,face] of this.faces.entries()) {
      centers.push(verts.push(blended(face.ids))-1);
      const row:number[]=[];
      face.ids.forEach((a,j)=>{
        const b=face.ids[(j+1)%face.ids.length], key=a<b?a+","+b:b+","+a;
        let ei=edgeIndex.get(key);
        if(ei===undefined) {
          ei=edges.length;edgeIndex.set(key,ei);edges.push({ends:[a,b],faces:[],id:-1});
          neighborEdges[a].push(ei);neighborEdges[b].push(ei);
        }
        edges[ei].faces.push(fi);row.push(ei);neighborFaces[a].push(fi);
      });
      faceEdges.push(row);
    }
    for(const edge of edges) {
      const ids=edge.faces.length===2?[...edge.ends,...edge.faces.map(i=>centers[i])]:edge.ends;
      edge.id=verts.push(blended(ids))-1;
    }
    const moved=this.vertices.map(({p},i)=>{
      const es=neighborEdges[i],fs=neighborFaces[i],n=es.length;
      if(!n||es.some(e=>edges[e].faces.length!==2))return p;
      const center=new THREE.Vector3(), twiceEdge=new THREE.Vector3();
      fs.forEach(f=>center.add(verts[centers[f]].p));
      es.forEach(e=>{const [a,b]=edges[e].ends;twiceEdge.add(verts[a].p).add(verts[b].p);});
      return p.clone().multiplyScalar(n-3).addScaledVector(center,1/n).addScaledVector(twiceEdge,1/n).multiplyScalar(1/n);
    });
    moved.forEach((p,i)=>{verts[i]={...verts[i],p};});
    const normals=verts.map(()=>new THREE.Vector3()), triangles:number[][]=[], tex:UV[][]=[];
    const triangle=(ids:number[],uv:UV[])=>{
      const [a,b,c]=ids.map(i=>verts[i].p);
      const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
      ids.forEach(i=>normals[i].add(normal));triangles.push(ids);tex.push(uv);
    };
    for(const [fi,face] of this.faces.entries()){
      const uc=face.uv.reduce<UV>((sum,v)=>[sum[0]+v[0]/face.uv.length,sum[1]+v[1]/face.uv.length],[0,0]);
      const n=face.ids.length,es=faceEdges[fi],c=centers[fi];
      for(let j=0;j<n;j++){
        const next=(j+1)%n,prev=(j+n-1)%n,a=face.ids[j],b=edges[es[j]].id,d=edges[es[prev]].id,u=face.uv[j];
        triangle([a,b,c],[u,avgUV(u,face.uv[next]),uc]);
        triangle([a,c,d],[u,uc,avgUV(u,face.uv[prev])]);
      }
    }
    // The tips of folded wings can converge onto one point. Carry a neighbouring surface normal
    // across that pole so skinning and glTF viewers never receive a zero-length normal.
    for(const tri of triangles){
      const adjacent=tri.find(i=>normals[i].lengthSq()>1e-18);
      if(adjacent!==undefined)for(const i of tri)if(normals[i].lengthSq()<=1e-18)normals[i].copy(normals[adjacent]);
    }
    normals.forEach(v=>{if(v.lengthSq()<=1e-18)v.set(0,1,0);else v.normalize();});
    const position:number[]=[],normal:number[]=[],uv:number[]=[],skin:number[]=[],weights:number[]=[],light:number[]=[],indices:number[]=[];
    const seam=new Map<string,number>();
    for(let f=0;f<triangles.length;f++)triangles[f].forEach((i,j)=>{
      const st=tex[f][j],key=i+"/"+Math.round(st[0]*65535)+"/"+Math.round(st[1]*65535);
      let index=seam.get(key);
      if(index===undefined){
        index=position.length/3;seam.set(key,index);
        const v=verts[i];position.push(...v.p.toArray());normal.push(...normals[i].toArray());uv.push(st[0],1-st[1]);light.push(v.glow);
        for(let c=0;c<4;c++){skin.push(v.weights[c]?.[0]??0);weights.push(v.weights[c]?.[1]??0);}
      }
      indices.push(index);
    });
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(position,3));
    g.setAttribute("normal",new THREE.Float32BufferAttribute(normal,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setAttribute("coatLight",new THREE.Float32BufferAttribute(light,1));
    g.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(skin,4));
    g.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
    g.setIndex(indices);
    const coarse:number[]=[];
    for(const face of this.faces){
      const corners=face.ids.map((id,j)=>{
        const st=face.uv[j];
        return seam.get(id+"/"+Math.round(st[0]*65535)+"/"+Math.round(st[1]*65535))!;
      });
      for(let j=1;j<corners.length-1;j++)coarse.push(corners[0],corners[j],corners[j+1]);
    }
    g.userData.lowIndex=Uint16Array.from(coarse);
    g.computeBoundingSphere();return g;
  }
}
