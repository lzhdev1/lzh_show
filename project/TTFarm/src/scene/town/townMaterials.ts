import * as THREE from "three";

/** 三渲二：4 阶色阶，Nearest 采样让明暗边界干净，不出现渐变糊边 */
const RAMP_STEPS = new Uint8Array([104, 170, 220, 255]);
const GLASS_STEPS = new Uint8Array([150, 204, 238, 255]);

function ramp(steps: Uint8Array) {
  const tex = new THREE.DataTexture(steps, 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const solidRamp = ramp(RAMP_STEPS);
const glassRamp = ramp(GLASS_STEPS);

export const townSolid = new THREE.MeshToonMaterial({
  vertexColors: true, gradientMap: solidRamp,
});
export const townGlass = new THREE.MeshToonMaterial({
  vertexColors: true, gradientMap: glassRamp,
});
export const townInk = new THREE.LineBasicMaterial({
  color: 0x3d3431, transparent: true, opacity: 0.72,
});
/** 展厅落地窗：真实透明，才能看见里面的展车 */
export const showroomGlass = new THREE.MeshStandardMaterial({
  color: 0xcfe9ef, transparent: true, opacity: 0.3,
  roughness: 0.08, metalness: 0.12, side: THREE.DoubleSide,
});
export const signFrame = new THREE.MeshToonMaterial({ color: 0x4c3b30, gradientMap: solidRamp });
export const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });

const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
const signTextures = new Set<THREE.CanvasTexture>();

/** 中文招牌：深色底板 + 暖白描边 + 粗体字，512×128 足够近景可读 */
export function signTexture(text: string, background = "#f3e7cd", foreground = "#41332a", border = "#8d6647") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  ctx.strokeRect(7, 7, 498, 114);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(14, 14, 484, 12);
  ctx.fillStyle = foreground;
  ctx.font = `700 66px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 69, 440);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  signTextures.add(tex);
  return tex;
}

export function signMaterial(tex: THREE.Texture) {
  return new THREE.MeshBasicMaterial({ map: tex, transparent: false });
}

export function disposeTownMaterials() {
  solidRamp.dispose();
  glassRamp.dispose();
  townSolid.dispose();
  townGlass.dispose();
  townInk.dispose();
  showroomGlass.dispose();
  signFrame.dispose();
  lampGlow.dispose();
  signTextures.forEach(tex => tex.dispose());
  signTextures.clear();
}
