import * as THREE from "three";

/**
 * 3D 气泡保留给菌圃里的“通灵菌”台词；角色聊天气泡改用屏幕层 HTML，
 * 不管相机怎么环绕、拉远拉近，字都是浏览器原生字形，不会被贴图 mipmap 抹糊。
 *
 * 头顶对话气泡（3D 版）：一次 Canvas 绘制（圆角、描边、小尾巴），
 * 之后只换贴图内容，不参与几何拼装。文字最多 5 行，超出用省略号。
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

export function createChatBubble(worldWidth = WORLD_WIDTH) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // 贴图是缩小的：关掉 mipmap，避免远景直接抽到低分辨率层，字被抹平。
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
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
      // 像素取整，避免亚像素定位把 58px 字再糊一圈。
      ctx.fillText(row, Math.round(cx), Math.round(TOP + PADDING + LINE * (index + 0.52)));
    });
    texture.needsUpdate = true;
    const height = worldWidth * (TOP + boxH + TAIL + 6) / WIDTH;
    sprite.scale.set(worldWidth, height, 1);
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

// —— 角色聊天气泡：屏幕层 HTML，只跟随头顶锚点投影，永远正对镜头 ——
interface ScreenBubble {
  anchor: THREE.Object3D;
  outer: HTMLDivElement;
  body: HTMLDivElement;
  label: HTMLSpanElement;
  text: string | null;
  visible: boolean;
}

const screenBubbles = new Set<ScreenBubble>();
let bubbleLayer: HTMLDivElement | null = null;
let styleReady = false;

function ensureStyle() {
  if (styleReady) return;
  styleReady = true;
  const style = document.createElement("style");
  style.dataset.ttfarm = "chat-bubble";
  style.textContent = `
#ttfarm-chat-bubbles {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  contain: layout style;
}
.ttfarm-chat-bubble {
  position: absolute;
  left: 0;
  top: 0;
  display: none;
  pointer-events: none;
  will-change: transform;
}
.ttfarm-chat-bubble-body {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  width: max-content;
  max-width: min(244px, calc(100vw - 28px));
  padding: 6px 13px 7px;
  border: 1.5px solid rgba(188, 174, 139, 0.96);
  border-radius: 13px;
  background: linear-gradient(180deg, #fffdf8 0%, #fff8e9 100%);
  box-shadow: 0 4px 14px rgba(38, 48, 33, 0.2), inset 0 1px 0 #fff;
  color: #26351f;
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.2px;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.72);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  -webkit-font-smoothing: antialiased;
  transform: translate(-50%, calc(-100% - 8px));
  transform-origin: 50% 100%;
}
.ttfarm-chat-bubble-body::after {
  position: absolute;
  left: 50%;
  bottom: -7px;
  z-index: -1;
  width: 13px;
  height: 13px;
  border-right: 1.5px solid rgba(188, 174, 139, 0.96);
  border-bottom: 1.5px solid rgba(188, 174, 139, 0.96);
  border-radius: 0 0 3px 0;
  background: #fff8e9;
  content: "";
  transform: translateX(-50%) rotate(45deg);
}
.ttfarm-chat-bubble-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}
.ttfarm-chat-bubble-body.is-new {
  animation: ttfarm-chat-pop 170ms cubic-bezier(.2,.8,.3,1.15) both;
}
@keyframes ttfarm-chat-pop {
  from { opacity: 0; transform: translate(-50%, calc(-100% - 8px)) scale(.9); }
  to { opacity: 1; transform: translate(-50%, calc(-100% - 8px)) scale(1); }
}
@media (pointer: coarse) {
  .ttfarm-chat-bubble-body { font-size: 14px; padding: 5px 11px 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .ttfarm-chat-bubble-body.is-new { animation: none; }
}
`;
  document.head.appendChild(style);
}

function ensureLayer() {
  if (bubbleLayer?.isConnected) return bubbleLayer;
  ensureStyle();
  const host = document.getElementById("ui") ?? document.body;
  bubbleLayer = document.createElement("div");
  bubbleLayer.id = "ttfarm-chat-bubbles";
  // 插在 HUD 之前，气泡在 3D 人物上方、所有面板和按钮下方。
  host.insertBefore(bubbleLayer, host.firstChild ?? null);
  return bubbleLayer;
}

/** 角色聊天气泡：锚点仍是 Object3D，位置和跟随逻辑与原来的 Sprite 完全一致 */
export function createScreenChatBubble() {
  const layer = ensureLayer();
  const anchor = new THREE.Object3D();
  anchor.visible = false;
  const outer = document.createElement("div");
  outer.className = "ttfarm-chat-bubble";
  const body = document.createElement("div");
  body.className = "ttfarm-chat-bubble-body";
  const label = document.createElement("span");
  label.className = "ttfarm-chat-bubble-text";
  body.appendChild(label);
  outer.appendChild(body);
  layer.appendChild(outer);

  const record: ScreenBubble = { anchor, outer, body, label, text: null, visible: false };
  screenBubbles.add(record);

  let current: string | null = null;
  return {
    sprite: anchor,
    set(text: string | null) {
      if (text === current) return;
      current = text;
      if (!text) {
        record.text = null;
        record.visible = false;
        anchor.visible = false;
        outer.style.display = "none";
        return;
      }
      record.text = text;
      record.visible = true;
      anchor.visible = true;
      label.textContent = text;
      outer.style.display = "block";
      // 重新触发一次轻微弹入；只在真正换文案时播。
      body.classList.remove("is-new");
      void body.offsetWidth;
      body.classList.add("is-new");
    },
    tick(_now?: number) { /* 屏幕层由 renderScreenChatBubbles 统一按相机投影 */ },
    dispose() {
      screenBubbles.delete(record);
      outer.remove();
      anchor.removeFromParent();
    },
  };
}

/**
 * 每帧在相机更新之后调用一次：把每个气泡的世界锚点投到屏幕上。
 * 文字不经过 WebGL 贴图，任意角度、远近都保持浏览器原生清晰度。
 */
export function renderScreenChatBubbles(camera: THREE.Camera, canvas: HTMLCanvasElement) {
  if (!bubbleLayer?.isConnected || screenBubbles.size === 0) return;
  camera.updateMatrixWorld();
  const rect = canvas.getBoundingClientRect();
  const point = new THREE.Vector3();
  for (const record of screenBubbles) {
    if (!record.visible || !record.anchor.visible) {
      record.outer.style.display = "none";
      continue;
    }
    let visible = true;
    let node: THREE.Object3D | null = record.anchor;
    while (node) {
      if (!node.visible) { visible = false; break; }
      node = node.parent;
    }
    if (!visible) { record.outer.style.display = "none"; continue; }

    record.anchor.getWorldPosition(point);
    point.project(camera);
    // 在相机背后或超出远裁剪面时不显示
    if (point.z < -1 || point.z > 1) {
      record.outer.style.display = "none";
      continue;
    }
    const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
    if (x < rect.left - 260 || x > rect.right + 260 || y < rect.top - 80 || y > rect.bottom + 80) {
      record.outer.style.display = "none";
      continue;
    }
    record.outer.style.display = "block";
    record.outer.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }
}
