// 把 TTFarm 的构建产物同步到作品集主站的 public/ttfarm
// 主站（blog_front）以 Next.js 静态目录托管这个游戏，因此不需要额外的容器和端口。
// 用法：pnpm sync-to-site（先 vite build，再执行本脚本）
import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const distDir = join(projectRoot, "dist");
const targetDir = resolve(projectRoot, "..", "..", "blog_front", "public", "ttfarm");

async function main() {
  if (!existsSync(distDir)) {
    console.error(`找不到构建产物：${distDir}\n先运行 pnpm build`);
    process.exitCode = 1;
    return;
  }
  // 只清空主站里的游戏目录，不碰 public 下的其他文件
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(distDir, targetDir, { recursive: true });
  const entries = await readdir(targetDir);
  console.log(`已同步到 ${targetDir}`);
  console.log(`包含：${entries.join("、")}`);
}

main();
