import * as THREE from "three";

/**
 * 头顶对话气泡：一次 Canvas 绘制（圆角、描边、小尾巴），
 * 之后只换贴图内容，不参与几何拼装。文字最多 4 行，超出用省略号。
 */
const WIDTH = 512;
const HEIGHT = 256;
const FONT = "600 30px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const LINE = 38;
const PADDING = 26;
const MAX_LINES = 4;
const WORLD_WIDTH = 2.15;

export function createChatBubble() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 20;
  sprite.visible = false;
  let current: string | null = null;

  function draw(text: string) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.font = FONT;
    const maxWidth = WIDTH - PADDING * 2 - 20;
    const lines: string[] = [];
    let line = "";
    for (const char of text) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; }
      else line = test;
    }
    if (line) lines.push(line);
    if (lines.length > MAX_LINES) {
      lines.length = MAX_LINES;
      lines[MAX_LINES - 1] = lines[MAX_LINES - 1].slice(0, -1) + "…";
    }
    let widest = 0;
    for (const row of lines) widest = Math.max(widest, ctx.measureText(row).width);
    const boxW = Math.min(WIDTH - 12, widest + PADDING * 2 + 20);
    const boxH = PADDING * 2 + lines.length * LINE;
    const left = (WIDTH - boxW) / 2;
    const top = 8;
    ctx.fillStyle = "rgba(255, 251, 240, 0.97)";
    ctx.strokeStyle = "rgba(196, 183, 146, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // 尾巴 + 圆角矩形一体绘制：先画尾巴，再盖住接缝
    ctx.moveTo(WIDTH / 2 - 16, top + boxH - 2);
    ctx.lineTo(WIDTH / 2, top + boxH + 18);
    ctx.lineTo(WIDTH / 2 + 16, top + boxH - 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(left, top, boxW, boxH, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#38492f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((row, index) => {
      ctx.fillText(row, WIDTH / 2, top + PADDING + LINE * (index + 0.5));
    });
    texture.needsUpdate = true;
    const height = WORLD_WIDTH * (top + boxH + 20) / WIDTH;
    sprite.scale.set(WORLD_WIDTH, height, 1);
  }

  return {
    sprite,
    /** 传 null 收起；同一句话不重复重绘 */
    set(text: string | null) {
      if (text === current) return;
      current = text;
      if (!text) { sprite.visible = false; return; }
      draw(text);
      const base = sprite.scale.clone();
      sprite.visible = true;
      sprite.scale.set(base.x * 0.92, base.y * 0.92, 1);
      sprite.userData.pop = { base, startedAt: performance.now() };
    },
    tick(now: number) {
      const pop = sprite.userData.pop as { base: THREE.Vector3; startedAt: number } | undefined;
      if (!pop || !sprite.visible) return;
      const k = Math.min(1, (now - pop.startedAt) / 170);
      const ease = 1 - (1 - k) ** 3;
      const grow = 0.92 + 0.08 * ease;
      sprite.scale.set(pop.base.x * grow, pop.base.y * grow, 1);
      if (k >= 1) sprite.userData.pop = undefined;
    },
    dispose() {
      texture.dispose();
      material.dispose();
      sprite.removeFromParent();
    },
  };
}
