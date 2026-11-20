import * as T from "three";
import { overallTexture } from "./overallTexture";
import type { VRM } from "@pixiv/three-vrm";
import type { AvatarId, OutfitId } from "../game/appearance";

type V = [number, number, number];
type Ring = [height: number, width: number, depth: number, centerZ: number];
type Binding = (x: number, y: number, z: number) => [number, number?, number?];

/** Garments and Qinghe's sculpt use the bind space of the bundled
 * VRM1_Constraint_Twist_Sample (© 2022 pixiv Inc.). Its embedded VRM metadata
 * permits modifications and redistribution. */
export function dressFarmer(vrm: VRM, avatar: AvatarId, outfit: OutfitId, bottom: OutfitId = outfit) {
  const male = avatar === "qinghe";
  const scene = vrm.scene;
  const shirt = scene.getObjectByName("Body_4") as T.SkinnedMesh;
  const shorts = scene.getObjectByName("Body_2") as T.SkinnedMesh;
  const shoes = scene.getObjectByName("Body_3") as T.SkinnedMesh;
  const restore: (() => void)[] = [];
  const skeleton = shirt.skeleton;
  const bones = new Map(skeleton.bones.map((b, i) => [b.name, i]));
  const index = (name: string) => bones.get("J_Bip_" + name)!;
  const head = index("C_Head"), hips = index("C_Hips"), chest = index("C_Chest"), upperChest = index("C_UpperChest");
  const rigid = (name: number): Binding => () => [name];
  const spine: Binding = (_, y) => y < 1.055
    ? [hips, chest, T.MathUtils.smoothstep(y, .905, 1.055)]
    : [chest, upperChest, T.MathUtils.smoothstep(y, 1.055, 1.205)];
  const forLeg = (side: number): Binding => {
    const label = side > 0 ? "L_" : "R_", thigh = index(label+"UpperLeg"), shin = index(label+"LowerLeg");
    return (_, y) => y > .71 ? [thigh, hips, T.MathUtils.smoothstep(y,.74,.965)]
      : [shin, thigh, T.MathUtils.smoothstep(y,.455,.575)];
  };
  const forArm = (side: number): Binding => {
    const label = side > 0 ? "L_" : "R_", upper = index(label+"UpperArm"), lower = index(label+"LowerArm");
    return x => [upper, lower, T.MathUtils.smoothstep(Math.abs(x), .29,.37)];
  };
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], joints: number[] = [], weights: number[] = [];
  const tint = new T.Color();
  function vertex(p: V, hex: number, bind: Binding) {
    const [a,b=a,f=0] = bind(...p);
    const n = positions.length/3;
    positions.push(...p); tint.setHex(hex).toArray(colors, colors.length);
    joints.push(a,b,0,0); weights.push(1-f,f,0,0);
    return n;
  }
  function shell(rows: V[][], color: number, binding: Binding, wrap = true) {
    const first = positions.length / 3, width = rows[0].length;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let k = 0; k < width; k++) {
        vertex(row[k], color, binding);
        if (j === 0 || (!wrap && k === width-1)) continue;
        const a = first + (j-1)*width+k, b = first+(j-1)*width+(k+1)%width;
        indices.push(a,b,a+width,b,b+width,a+width);
      }
    }
  }
  const ellipse = (center: number, profiles: Ring[], color: number, binding: Binding, seg = 28) =>
    shell(profiles.map(([y,w,d,z]) => Array.from({length:seg}, (_,i): V => {
      const t = i * Math.PI*2/seg;
      return [center + w*Math.sin(t), y, z+d*Math.cos(t)];
    })), color, binding);
  function orb(p: V, radius: V, color: number, bind: Binding) {
    const rows = Array.from({length:9}, (_,i): Ring => {
      const a = (i/8-.5)*Math.PI;
      return [p[1]+Math.sin(a)*radius[1], Math.max(.001,Math.cos(a))*radius[0],Math.max(.001,Math.cos(a))*radius[2],p[2]];
    });
    ellipse(p[0], rows, color, bind, 16);
  }
  // An elliptical lock follows a quadratic centreline, tapering into a point.
  function strand(a: V, b: V, c: V, width: number, depth: number, color: number) {
    const rows = Array.from({length:9}, (_,i) => {
      const t=i/8, u=1-t, x=u*u*a[0]+2*t*u*b[0]+t*t*c[0], y=u*u*a[1]+2*t*u*b[1]+t*t*c[1];
      const z=u*u*a[2]+2*t*u*b[2]+t*t*c[2], w=(.72+.28*Math.sin(Math.PI*t))*Math.pow(1-t,.67)+.008;
      return Array.from({length:8}, (_,j): V => [x+width*w*Math.sin(j*Math.PI/4),y,z+depth*w*Math.cos(j*Math.PI/4)]);
    });
    shell(rows,color,rigid(head));
  }
  function panel(rows: V[][], color: number) { shell(rows,color,spine,false); }
  function fabric(mesh: T.SkinnedMesh, color: number, map: T.Texture | null = null) {
    // VRoid stores the outline as a second draw group on the same geometry.
    // Replace only the fabric pass; retain the original silhouette line.
    const original = mesh.material;
    const mats = Array.isArray(original) ? original : [original];
    const next = mats.map(mat => {
      const m = mat.clone() as T.MeshStandardMaterial & { isOutline?: boolean; shadeColorFactor?: T.Color; shadeMultiplyTexture?: T.Texture | null };
      if (m.isOutline || !m.color) return m;
      m.map = map;
      m.color.setHex(color);
      if (m.shadeColorFactor) m.shadeColorFactor.copy(m.color).multiplyScalar(.74);
      m.shadeMultiplyTexture = map;
      m.needsUpdate = true;
      return m;
    });
    mesh.material = Array.isArray(original) ? next : next[0];
    restore.push(() => { mesh.material = original; next.forEach(m => m.dispose()); });
  }

  if (male) {
    scene.getObjectByName("Hair")!.visible = false;
    fabric(scene.getObjectByName("Body_5") as T.SkinnedMesh,0x293a38);
    restore.push(() => { scene.getObjectByName("Hair")!.visible = true; });
    scene.traverse(node => {
      if (!(node instanceof T.SkinnedMesh)) return;
      const attr = node.geometry.getAttribute("position");
      const face = node.name.startsWith("Face");
      const torso = node === shirt || node.name === "Body_1";
      if (!face && !torso) return;
      const normal = node.geometry.getAttribute("normal");
      const original = attr.array.slice(), normals = normal.array.slice();
      restore.push(() => {
        attr.array.set(original); normal.array.set(normals);
        attr.needsUpdate = normal.needsUpdate = true;
      });
      for (let i=0;i<attr.count;i++) {
        let x=attr.getX(i), y=attr.getY(i), z=attr.getZ(i);
        if (face) {
          const jaw = 1-T.MathUtils.smoothstep(y,1.345,1.45);
          x *= 1.045+.30*jaw;
          y -= .007*jaw;
          if (/Face_[2457]/.test(node.name)) y = 1.444 + (y-1.444)*.82;
          if (node.name==="Face_6") y = 1.470+(y-1.48)*1.85+.080*Math.abs(x);
        } else if (y>.88 && y<1.34) {
          const shoulders=T.MathUtils.smoothstep(y,.89,1.26);
          x *= 1+.13*shoulders*(1-T.MathUtils.smoothstep(Math.abs(x),.13,.36));
          if (z>0) z *= 1-.22*shoulders;
        }
        attr.setXYZ(i,x,y,z);
      }
      attr.needsUpdate=true;
      node.geometry.computeVertexNormals();
    });

    // Cropped nape, notched temples and a row of swept, overlapping fringe locks.
    const hair = [0x273737,0x324747,0x384c49,0x293d3c];
    const rows=Array.from({length:15},(_,i) => Array.from({length:48},(_,j):V => {
      const t=j*Math.PI/24, front=Math.cos(t), temple=Math.sin(t);
      const rim=1.457+.050*front-.025*(1-front)*.5-.011*Math.abs(temple)**5;
      const rootY=1.465, angle=Math.acos(T.MathUtils.clamp((rim-rootY)/.147,-1,1))*(1-i/14);
      const rear = Math.max(0,-front);
      return [.112*Math.sin(angle)*temple,rootY+.146*Math.cos(angle),
        -.012+(.111+.027*rear)*Math.sin(angle)*front-.010*rear];
    }));
    shell(rows,hair[0],rigid(head));
    for(let j=0;j<13;j++) {
      const s=(j-6)/6, crown=.031+s*.061;
      strand([crown,1.583-.024*Math.abs(s),.042-.019*s*s],
        [s*.078+.007,1.552,.108-.043*s*s],
        [s*.091-.023,1.488-.027*(1-s*s)+.009*Math.cos(3*j),.092-.046*s*s],
        .022,.014,hair[j%hair.length]);
    }
    for(const side of [-1,1]) for(let j=0;j<5;j++) {
      const f=j/4;
      strand([side*(.062+.020*f),1.554,-.002-.063*f], [side*(.122-.012*f),1.527,-.009-.072*f],
        [side*(.102-.032*f),1.428-.049*f,-.003-.079*f],.015,.023,hair[(j+2)%4]);
    }
    for (let i=0;i<13;i++) {
      const a=(i-6)*.16, x=Math.sin(a), back=Math.cos(a);
      strand([.089*x,1.543,-.037-.100*back], [.107*x,1.467,-.039-.115*back],
        [.078*x-.004,1.393+.024*Math.abs(x)+.006*Math.sin(i*3.1),-.040-.073*back],
        .017,.014,hair[(i+1)%4]);
    }
    // A loose crown strand interrupts the outline even at gameplay distance.
    strand([.006,1.574,-.012],[-.034,1.621,-.019],[-.076,1.599,-.018],.016,.011,hair[1]);
  } else if (outfit !== "field") {
    // The hood and pack sit behind the shoulders. For these outfits the long
    // back layers tuck into a working bob, leaving the collar and straps clear.
    const hair = scene.getObjectByName("Hair") as T.SkinnedMesh;
    const pos = hair.geometry.getAttribute("position"), normal = hair.geometry.getAttribute("normal");
    const before = pos.array.slice(), normals = normal.array.slice();
    for (let i=0;i<pos.count;i++) {
      const y=pos.getY(i);
      if (y>=1.395) continue;
      const t=T.MathUtils.smoothstep(1.395-y,0,.28);
      pos.setXYZ(i,pos.getX(i)*(1-.09*t),1.395+(y-1.395)*(outfit==="raincoat" ? .18 : .39),pos.getZ(i)+.009*t);
    }
    pos.needsUpdate=true; hair.geometry.computeVertexNormals();
    restore.push(() => {
      pos.array.set(before); normal.array.set(normals);
      pos.needsUpdate=normal.needsUpdate=true;
    });
  }

  const field=outfit==="field", rain=outfit==="raincoat";
  if (!field || bottom !== "field" || male) {
    const trousers = male || bottom !== "field";
    // Standard wardrobe body mask. Covering the skin triangles keeps a deep
    // knee or elbow bend from exposing little skin-coloured wedges in the cloth.
    if (trousers || rain) {
      const body = scene.getObjectByName("Body_1") as T.SkinnedMesh;
      const original = body.geometry, geometry = original.clone();
      const source = original.index!, pos = original.getAttribute("position"), keep: number[] = [];
      const groups = original.groups.length ? original.groups : [{start:0,count:source.count,materialIndex:0}];
      const covered = (i: number) => {
        const y = pos.getY(i), x = Math.abs(pos.getX(i));
        return (trousers && y < .725) || (rain && y > 1.18 && y < 1.36 && x > .24 && x < .505);
      };
      geometry.clearGroups();
      for (const group of groups) {
        const start = keep.length;
        for (let i=group.start; i<group.start+group.count; i+=3) {
          const a=source.getX(i), b=source.getX(i+1), c=source.getX(i+2);
          if (!covered(a) || !covered(b) || !covered(c)) keep.push(a,b,c);
        }
        geometry.addGroup(start, keep.length-start, group.materialIndex);
      }
      geometry.setIndex(keep);
      body.geometry = geometry;
      restore.push(() => { body.geometry = original; geometry.dispose(); });
    }
    const shirtColor = field ? 0xe4d7b1 : rain ? 0xdb9c36 : 0x536955;
    const denim = bottom === "field" ? 0x405867 : bottom === "raincoat" ? 0x344f60 : 0xa28762;
    const leather = bottom === "field" ? 0x70452d : bottom === "raincoat" ? 0x355b64 : 0x714b37;
    if (field && male) {
      const bib = overallTexture(); fabric(shirt,0xffffff,bib); restore.push(() => bib.dispose());
    } else if (!field) fabric(shirt,shirtColor);
    if (trousers) { fabric(shorts,denim); fabric(shoes,leather); }
    for (const side of trousers ? [-1,1] : []) {
      const leg=forLeg(side);
      const center=.077*side;
      ellipse(center,[[.075,.049,.049,-.030],[.12,.054,.049,-.030],[.25,.061,.066,-.026],
        [.45,.059,.067,-.010],[.515,.064,.07,-.006],[.57,.068,.074,-.003],[.72,.080,.091,.002],
        [.80,.080,.093,.002],[.87,.066,.081,.007]],denim,leg,24);
      const bootTop=bottom === "raincoat" ? .31 : .165;
      ellipse(center,[[.066,.051,.058,-.031],[.094,.056,.056,-.030],[bootTop-.025,.063,.069,-.023],
        [bootTop,.063,.07,-.023]],leather,leg,22);
      ellipse(center,[[bootTop-.024,.064,.070,-.023],[bootTop-.012,.065,.071,-.023],[bootTop,.064,.071,-.023]],
        bottom === "raincoat" ? 0xd8b264 : 0x987450,leg,22);
    }
    if(rain) {
      const yellow=0xe6aa3f, seam=0xf3c968;
      const hatProfile: Ring[] = [[1.516,.111,.115,-.009],[1.505,.155,.155,-.014],
        [1.513,.156,.171,-.022],[1.535,.126,.149,-.020],[1.586,.112,.133,-.024],
        [1.617,.077,.093,-.026],[1.630,.006,.006,-.022]];
      // A sou'wester's rear brim shelters the neck, the turned front stays above the eyes.
      shell(hatProfile.map(([height,w,d,z],j)=>Array.from({length:36},(_,i):V=>{
        const a = i*Math.PI/18, rear = (1-Math.cos(a))*.5;
        const edge=j===1||j===2 ? 1 : 0;
        return [w*Math.sin(a),height-edge*rear*.036,z+d*Math.cos(a)-edge*rear*.036];
      })),0xe5ac46,rigid(head));
      ellipse(0,[[1.538,.127,.150,-.020],[1.551,.124,.148,-.021]],0x617667,rigid(head));
      ellipse(0,[[.747,.183,.139,.002],[.765,.186,.141,.002],[.87,.177,.135,0],
        [.99,.155,.137,.004],[1.082,.151,.138,.006],[1.20,.153,.137,-.001],[1.26,.153,.107,-.011],[1.306,.081,.078,-.018]],yellow,spine);
      ellipse(0,[[.757,.186,.142,.002],[.767,.187,.143,.002]],seam,spine);
      // Folded storm hood with the opening behind the collar.
      ellipse(0,[[1.195,.121,.098,-.044],[1.225,.144,.125,-.044],[1.257,.161,.131,-.047],
        [1.299,.133,.107,-.037],[1.323,.097,.082,-.034],[1.302,.063,.060,-.032]],0xeab344,spine);
      for(const side of [-1,1]) {
        const sleeve=(profile: number[][],color:number) => shell(profile.map(([x,r])=>Array.from({length:18},(_,i):V => {
          const angle=i*Math.PI/9;return [side*x,1.274+r*Math.cos(angle),-.026+r*Math.sin(angle)];
        })),color,forArm(side));
        sleeve([[.156,.057],[.225,.061],[.333,.055],[.435,.051],[.50,.044],[.525,.040]],yellow);
        sleeve([[.454,.051],[.466,.050]],0xe8c97e);
        sleeve([[.501,.047],[.526,.042]],seam);
        panel([[[side*.064,.795,.137],[side*.114,.800,.116],[side*.149,.816,.091]],
          [[side*.066,.869,.135],[side*.113,.883,.115],[side*.146,.898,.090]]],0xd49a36);
        panel([[[side*.066,.865,.140],[side*.113,.879,.119],[side*.145,.894,.095]],
          [[side*.066,.875,.139],[side*.113,.889,.118],[side*.145,.904,.094]]],0xbc852f);
        panel([[[side*.048,1.194,.137],[side*.052,1.194,.137]],
          [[side*.049,1.274,.106],[side*.053,1.274,.106]]],0xf9df9d);
        orb([side*.049,1.194,.138],[.006,.010,.005],0x786e51,spine);
      }
      panel([[[-.013,.76,.145],[.013,.76,.145]],[[-.013,1.08,.147],[.013,1.08,.147]],
        [[-.013,1.2,.138],[.013,1.2,.138]],[[-.013,1.284,.088],[.013,1.284,.088]]],seam);
      for(let j=0;j<5;j++)orb([.002,.827+j*.096,j===4?.137:.148],[.006,.006,.004],0x72674d,spine);
    } else if (!field) {
      // Quilted trail vest, throat kerchief and an external-frame canvas pack.
      ellipse(0,[[.87,.179,.133,.001],[.904,.168,.132,.003],[.985,.154,.133,.004],
        [1.096,.146,.134,.005],[1.19,.152,.127,0],[1.267,.153,.088,-.012],[1.298,.105,.078,-.018]],0x425d4d,spine);
      ellipse(0,[[1.245,.077,.085,-.015],[1.271,.088,.089,-.016],[1.304,.077,.075,-.024],[1.32,.060,.057,-.021]],0xbe7045,spine);
      panel([[[-.044,1.263,.092],[0,1.265,.102],[.048,1.263,.087]],
        [[-.033,1.232,.130],[0,1.230,.138],[.038,1.231,.124]],
        [[.008,1.194,.141],[.015,1.178,.145],[.022,1.198,.14]]],0xca7e4c);
      for(const side of [-1,1]){
        const x=.085*side;
        panel([[[x-.012,.944,.123],[x+.012,.944,.123]],[[x-.014,1.19,.115],[x+.014,1.19,.115]],
          [[x-.016,1.296,.046],[x+.016,1.296,.046]],[[x-.016,1.315,-.044],[x+.016,1.315,-.044]],
          [[x-.015,1.182,-.104],[x+.015,1.182,-.104]]],0x735640);
        orb([x,1.138,.126],[.018,.01,.006],0xc8b77f,spine);
        panel([[[side*.056,.963,.134],[side*.100,.963,.117],[side*.123,.968,.101]],
          [[side*.057,1.018,.133],[side*.100,1.018,.115],[side*.123,1.018,.101]]],0x587462);
        panel([[[side*.055,1.009,.136],[side*.099,1.000,.119],[side*.125,1.008,.103]],
          [[side*.055,1.025,.136],[side*.099,1.025,.119],[side*.125,1.025,.103]]],0x73836b);
        orb([side*.098,1.006,.122],[.006,.006,.004],0xc8b77f,spine);
      }
      ellipse(0,[[.925,.087,.035,-.123],[.961,.113,.064,-.140],[1.09,.12,.076,-.143],[1.157,.107,.060,-.135],
        [1.177,.083,.038,-.124]],0x946b45,spine,24);
      ellipse(0,[[1.083,.118,.076,-.144],[1.117,.123,.078,-.143],[1.163,.106,.060,-.137],[1.173,.088,.046,-.132]],0xb59363,spine,24);
      for(const side of [-1,1])orb([side*.055,1.076,-.204],[.011,.032,.006],0x624633,spine);
    }
  }
  if (!positions.length) return () => restore.forEach(reset => reset());
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute("skinIndex",new T.Uint16BufferAttribute(joints,4));
  geometry.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const material = new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.92});
  const garment = new T.SkinnedMesh(geometry,material);
  garment.name = avatar+"-"+outfit;
  garment.frustumCulled=false;
  garment.castShadow=true;
  garment.bind(skeleton,shirt.bindMatrix);
  shirt.parent!.add(garment);
  return () => {
    garment.removeFromParent(); geometry.dispose(); material.dispose();
    restore.forEach(reset => reset());
  };
}
