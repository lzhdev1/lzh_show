import * as THREE from "three";
import type { DollAdd, V } from "./geometry";

export const TAU = Math.PI * 2;
export type Seam = [height: number, width: number, depth: number, x?: number, z?: number];
export type Section = [x: number, y: number, z: number, width: number, depth?: number];

export function tailor(add: DollAdd) {
  function satin(rows: V[][], color: number, brocade?: [number, number, number, number],
    shade?: (point: V, u: number, v: number) => number) {
    const cols = rows[0].length, last = rows.length - 1;
    const normalsTint: number[] = [], uv: number[] = [], points: number[] = [], indices: number[] = [];
    rows.forEach((row, r) => row.forEach((p, c) => {
      points.push(...p);
      const u = c / (cols - 1), v = r / last;
      const value = (1.075 - .17 * v + .045 * Math.cos(TAU * (u - .2))) * (shade?.(p,u,v) ?? 1);
      normalsTint.push(value, value * (.99 + .015 * v), value * (1 + .045 * v));
      if (brocade) uv.push(brocade[0] + (brocade[2] - brocade[0]) * u, brocade[3] - (brocade[3] - brocade[1]) * v);
      if (r < last && c + 1 < cols) {
        const a = r * cols + c;
        indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(normalsTint, 3));
    if (brocade) { g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.userData.dollAtlas = true; }
    g.setIndex(indices); g.computeVertexNormals();
    if(rows.every(row=>row[0].every((n,k)=>Math.abs(n-row[cols-1][k])<.00001))) {
      const normals=g.getAttribute("normal"), a=new THREE.Vector3(), b=new THREE.Vector3();
      for(let row=0;row<rows.length;row++){
        const first=row*cols,end=first+cols-1;
        a.fromBufferAttribute(normals,first);b.fromBufferAttribute(normals,end);
        a.add(b).normalize();
        normals.setXYZ(first,a.x,a.y,a.z);normals.setXYZ(end,a.x,a.y,a.z);
      }
    }
    add(g, color);
  }

  function cut(outline: Seam[], seg = 24, from = -Math.PI, to = Math.PI, pleats = 0, fold = 0, scallop = 0): V[][] {
    return outline.map(([y,rx,rz,x=0,z=0], j) =>
      Array.from({length:seg+1}, (_,i): V => {
        const a = from + (to - from) * i / seg, t = j / (outline.length - 1);
        const ridge = t * t * fold * Math.cos(pleats * a + .2);
        return [x + (rx + ridge) * Math.sin(a), y + t * t * scallop * Math.cos(pleats * a),
          z + (rz + ridge) * Math.cos(a)];
      }));
  }

  function shell(rows: Seam[], color: number, seg = 22) { satin(cut(rows,seg), color); }

  function stitch(points: V[], radius: number, color: number, sections = Math.max(3, points.length - 1)) {
    if (points.length < 2) return;
    const curve = points.length === 2 ? new THREE.LineCurve3(new THREE.Vector3(...points[0]), new THREE.Vector3(...points[1]))
      : new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,"centripetal");
    add(new THREE.TubeGeometry(curve, sections, radius, 5, false), color);
  }

  // Sections follow the arm or leg axis. The rings at elbow, knee and cuff let
  // one continuous piece of cloth change from fitted to gathered along a pose.
  function shaped(path: Section[], color: number, sides = 12, flute = 0) {
    // An extra section at each long join rounds bent limbs and prevents a
    // hard crease where a sleeve turns back towards the raised wrist.
    const samples:Section[]=[];
    const centres=path.map(p=>new THREE.Vector3(p[0],p[1],p[2]));
    const curve = path.length>2 ? new THREE.CatmullRomCurve3(centres,false,"centripetal") : undefined;
    path.forEach((p,i)=>{
      samples.push(p);
      if(!curve || i+1===path.length || centres[i].distanceTo(centres[i+1])<.042)return;
      const q=path[i+1], mid=curve.getPoint((i+.5)/(path.length-1));
      samples.push([mid.x,mid.y,mid.z,(p[3]+q[3])/2,((p[4]??p[3])+(q[4]??q[3]))/2]);
    });
    const rows = samples.map(([x,y,z,width,depth=width],i) => {
      const a=samples[Math.max(0,i-1)], b=samples[Math.min(samples.length-1,i+1)];
      const tangent=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
      const side = new THREE.Vector3().crossVectors(Math.abs(tangent.z)<.97?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),tangent).normalize();
      const forward = new THREE.Vector3().crossVectors(tangent,side);
      return Array.from({length:sides+1},(_,j):V=>{
        const angle = j*TAU/sides, ridge = 1+flute*Math.cos(5*angle);
        const sx = width*Math.sin(angle)*ridge, sz=depth*Math.cos(angle)*ridge;
        return [x+side.x*sx+forward.x*sz,y+side.y*sx+forward.y*sz,z+side.z*sx+forward.z*sz];
      });
    });
    satin(rows,color,undefined,(_p,u,v)=>1-.055*v+.04*Math.cos(TAU*(u+.09)));
    return rows;
  }

  function gem(at: V, scale: V, color: number, rz=0) {
    add(new THREE.OctahedronGeometry(1),color,at,[0,.23,rz],scale);
  }
  function bead(at: V, size: V, color: number, rz=0) {
    add(new THREE.SphereGeometry(1,10,6),color,at,[0,0,rz],size);
  }
  function bow(center: V, width: number, color: number, trim:number) {
    const [x,y,z]=center;
    for(const s of [-1,1]) {
      const knots=[[0,.035,.02],[.34,.14,.15],[.73,.24,.12],[.88,.26,.03],[.96,.17,-.07]];
      const rows=knots.map(([reach,flare,front])=>[-1,0,1].map((v):V=>
        [x+s*width*reach,y+width*(.13*reach+flare*v),z+width*(front+.13*(1-v*v))]));
      satin(rows,color);
      stitch(rows.map(r=>r[0]),.0019,trim);
      const tail:V[][]=[[.04,-.05,.07],[.19,-.29,.12],[.29,-.54,.09],[.45,-.79,.0]].map(([reach,hang,front],i)=>
        [-1,0,1].map((v):V=>[x+s*width*(reach+v*.10),y+width*(hang+(i===3?.08*v:0)),z+width*(front+.03*(1-v*v))]));
      satin(tail,color);
    }
    gem([x,y,z+.008],[width*.18,width*.21,.012],trim);
  }
  return {satin,cut,shell,stitch,shaped,gem,bead,bow};
}

export type Tailor = ReturnType<typeof tailor>;
