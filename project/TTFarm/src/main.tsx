import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { startGame } from "./game/loop";
import { useGame } from "./game/state";
import { startAutoSave } from "./game/account";
import "./styles.css";

const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui");

if (!canvas || !uiRoot) {
  throw new Error("场景容器缺失");
}

createRoot(uiRoot).render(<App />);

// 登录后每次存盘变动都会自动同步到数据库
startAutoSave();

try {
  startGame(canvas);
} catch (error) {
  console.error("[TT农场] 场景初始化失败", error);
  canvas.style.display = "none";
  useGame.getState().notify("这台设备没能启动 3D 场景，换台设备试试", "warn");
}

const welcomed = window.localStorage.getItem("ttfarm-welcome");
if (!welcomed) {
  window.localStorage.setItem("ttfarm-welcome", "1");
  window.setTimeout(() => {
    useGame.getState().notify("走到地块旁边，点它就能种菜");
  }, 900);
}
