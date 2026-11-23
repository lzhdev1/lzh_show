import * as THREE from "three";

/**
 * 头顶对话气泡：一次 Canvas 绘制（圆角、描边、小尾巴），
 * 之后只换贴图内容，不参与几何拼装。文字最多 5 行，超出用省略号。
 * 画布按 2 倍分辨率绘制，贴在 3D 场景里字体边缘更干净。
 */
const WIDTH = 1024;
const HEIGHT = 520;
const FONT = "600 58px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const LINE = 74;
const PADDING = 44;
const MAX_LINES = 5;
const WORLD_WIDTH = 3.2;
const TOP = 10;
const TAIL = 40;

export function createChatBubble() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
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
    const maxWidth = WIDTH - PADDING * 2 - 40;
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
    const boxW = Math.min(WIDTH - 24, Math.max(widest + PADDING * 2 + 40, 360));
    const boxH = PADDING * 2 + lines.length * LINE;
    const left = (WIDTH - boxW) / 2;
    const cx = WIDTH / 2;

    ctx.save();
    ctx.shadowColor = "rgba(38, 48, 33, 0.22)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = "rgba(255, 252, 244, 0.985)";
    ctx.beginPath();
    ctx.moveTo(cx - 30, TOP + boxH - 6);
    ctx.lineTo(cx, TOP + boxH + TAIL);
    ctx.lineTo(cx + 30, TOP + boxH - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(left, TOP, boxW, boxH, 48);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(188, 174, 139, 0.92)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(left, TOP, boxW, boxH, 48);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 30, TOP + boxH - 5);
    ctx.lineTo(cx, TOP + boxH + TAIL);
    ctx.lineTo(cx + 30, TOP + boxH - 5);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(left + 5, TOP + 5, boxW - 10, boxH - 10, 43);
    ctx.stroke();

    ctx.fillStyle = "#2f4029";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((row, index) => {
      ctx.fillText(row, cx, TOP + PADDING + LINE * (index + 0.52));
    });
    texture.needsUpdate = true;
    const height = WORLD_WIDTH * (TOP + boxH + TAIL + 6) / WIDTH;
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
