import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import type { GameHandle } from "./game/loop";
import { useGame } from "./game/state";
import { startAutoSave } from "./game/account";
import "./styles.css";
import "./ui/field-controls.css";
import "./ui/customization.css";

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");

if (!canvas || !uiRoot) {
  throw new Error("场景容器缺失");
}

const root = createRoot(uiRoot);
root.render(<App />);

// 登录后每次存盘变动都会自动同步到数据库
const stopAutoSave = startAutoSave();
let game: GameHandle | undefined;
let disposed = false;
import("./game/loop").then(({ startGame }) => {
  if (!disposed) game = startGame(canvas);
}).catch((error) => {
  console.error("[TT农场] 场景初始化失败", error);
  if (disposed) return;
  canvas.style.display = "none";
  useGame.getState().notify("这台设备没能启动 3D 场景，换台设备试试", "warn");
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    game?.dispose();
    stopAutoSave();
    root.unmount();
  });
}

const welcomed = window.localStorage.getItem("ttfarm-welcome");
if (!welcomed) {
  window.localStorage.setItem("ttfarm-welcome", "1");
  window.setTimeout(() => {
    useGame.getState().notify("选好种子，走上菜地，点「撒种」种下第一株菜");
  }, 900);
}
