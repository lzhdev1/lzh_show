import * as THREE from "three";

/** Tileable brush marks keep the open pasture readable at both walking height and map scale. */
export function meadowGround() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#a1bd80";
  ctx.fillRect(0,0,256,256);
  let seed = 29483;
  const sample = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 135; i++) {
    const x = sample()*256, y = sample()*256;
    const w = 2+sample()*13, h = 0.6+sample()*2;
    ctx.fillStyle = i % 2 ? "rgba(111,154,107,.14)" : "rgba(208,206,144,.21)";
    for (const dx of [-256,0,256]) for (const dy of [-256,0,256]) {
      ctx.beginPath();
      ctx.ellipse(x+dx,y+dy,w,h,-.27,0,Math.PI*2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1/12,1/12);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return new THREE.MeshStandardMaterial({map:tex, roughness:1});
}
