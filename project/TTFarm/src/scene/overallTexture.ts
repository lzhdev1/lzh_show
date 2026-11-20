import { CanvasTexture, SRGBColorSpace } from "three";

/** Hand-painted panels in the bundled shirt's front/back UV islands. */
export function overallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 400; canvas.height = 800;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2,2); ctx.lineJoin = ctx.lineCap = "round";
  const path = (d: string, color: string) => { ctx.fillStyle = color; ctx.fill(new Path2D(d)); };
  const line = (d: string, color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(new Path2D(d));
  };
  ctx.fillStyle = "#dfd4b8"; ctx.fillRect(0,0,200,400);
  for (const y of [0,200]) {
    ctx.save(); ctx.translate(0,y);
    path("M1 49 L9 47 40 93 33 99Z M194 48 L201 52 169 100 161 94Z","#a8b59d");
    line("M4 51 L35 96 M197 52 L164 98","#ede1be",1.1);
    ctx.restore();
  }
  path("M75 32 L95 49 86 61 67 37Z M125 32 L105 49 113 61 133 37Z","#b49567");
  path("M76 31 L96 47 87 56 68 36Z M124 31 L104 47 113 56 132 36Z","#ece2c9");
  const denim = "#394f5c", edge="#b5a47f";
  for(const d of ["M58 35 L69 33 82 87 74 89Z","M133 33 L144 35 126 90 118 87Z",
    "M41 166 L41 125 65 125 Q72 107 74 83 Q98 89 125 83 Q130 112 136 125 L159 125 159 169Z",
    "M57 237 L69 233 126 315 138 339 129 342Z","M131 233 L143 237 72 340 62 337Z",
    "M40 324 Q99 334 159 324 L160 373 40 373Z"]) path(d,denim);
  line("M60 37 L76 84 M140 38L124 84 M44 162 L44 129 68 128 Q75 105 77 87 Q101 92 122 87 Q125 109 132 128 L156 129 156 164",edge,.9,[2,.9]);
  path("M83 98 Q98 101 118 97 L116 115 100 121 84 116Z","#526b73");
  line("M85 100 L114 100 M86 102 L87 114 100 118 113 114 115 102",edge,.8,[2,1]);
  path("M109 103 L114 103 113 107 109 107Z","#ba8050");
  line("M53 138 Q59 146 72 148 M126 148 Q142 146 149 136 M44 164 Q98 168 157 164 M43 366 Q100 369 158 366",edge,1,[2.2,1]);
  for(const [x,y] of [[77,85],[122,85],[85,99],[116,98],[72,147],[126,147]]){
    ctx.fillStyle="#684c32";ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d6b577";ctx.beginPath();ctx.arc(x-.3,y-.4,1.2,0,Math.PI*2);ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
