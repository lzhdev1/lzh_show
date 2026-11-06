import type { ReactNode } from "react";
import { CROPS } from "../game/crops";
import { formatRemain, growthProgress, isReady, MAX_WATER, remainingMs } from "../game/growth";
import { LAND_PRICES, START_UNLOCKED, useGame } from "../game/state";
import { useClock } from "../game/clock";
import { CloseIcon, CropIcon, HarvestIcon, LandIcon, SeedIcon, WaterIcon } from "./icons";

export function PlotSheet({ onOpenShop }: { onOpenShop: () => void }) {
  const selectedPlot = useGame((s) => s.selectedPlot);
  const plots = useGame((s) => s.plots);
  const seeds = useGame((s) => s.seeds);
  const selectedSeed = useGame((s) => s.selectedSeed);
  const plant = useGame((s) => s.plant);
  const water = useGame((s) => s.water);
  const harvestPlot = useGame((s) => s.harvestPlot);
  const expand = useGame((s) => s.expand);
  const selectPlot = useGame((s) => s.selectPlot);
  const now = useClock((s) => s.now);

  if (selectedPlot === null) return null;
  const plot = plots[selectedPlot];
  if (!plot) return null;

  const close = () => selectPlot(null);
  const seed = CROPS[selectedSeed];

  let title = "";
  let subtitle = "";
  let progress: number | null = null;
  let action: ReactNode = null;

  if (!plot.unlocked) {
    const price = LAND_PRICES[plot.id - START_UNLOCKED] ?? 720;
    title = "未开垦的地块";
    subtitle = `开垦需要 ${price} 金币`;
    action = (
      <button className="btn primary" onClick={() => expand()}>
        <LandIcon />
        开垦这块地
      </button>
    );
  } else if (!plot.crop) {
    title = "空地，可以播种";
    subtitle =
      seeds[selectedSeed] > 0
        ? `当前选中：${seed.name}，种子 ×${seeds[selectedSeed]}`
        : `${seed.name}种子用完了`;
    action =
      seeds[selectedSeed] > 0 ? (
        <button className="btn primary" onClick={() => plant(plot.id)}>
          <SeedIcon />
          播种{seed.name}
        </button>
      ) : (
        <button className="btn soft" onClick={onOpenShop}>
          去商店买种子
        </button>
      );
  } else {
    const def = CROPS[plot.crop];
    const ready = isReady(plot, now);
    progress = growthProgress(plot, now);
    title = `${def.name}${ready ? " · 成熟了" : " · 生长中"}`;
    const remain = remainingMs(plot, now);
    subtitle = ready
      ? `可以收获 ${def.yields} 份，卖 ${def.sellPrice} 金币/份`
      : `还需 ${formatRemain(remain ?? 0)} · 已浇水 ${plot.watered}/${MAX_WATER}`;

    action = ready ? (
      <button className="btn primary" onClick={() => harvestPlot(plot.id)}>
        <HarvestIcon />
        收获
      </button>
    ) : (
      <button
        className="btn primary"
        onClick={() => water(plot.id)}
        disabled={plot.watered >= MAX_WATER}
      >
        <WaterIcon />
        {plot.watered >= MAX_WATER ? "浇过水了" : "浇水"}
      </button>
    );
  }

  return (
    <div className="sheet" role="dialog" aria-label="地块操作">
      <div className="sheet-head">
        <div className="sheet-head-left">
          <span className="plot-no">第 {plot.id + 1} 号地</span>
          {plot.unlocked ? <span className="dot" /> : null}
        </div>
        <button className="icon-btn ghost" onClick={close} aria-label="关闭">
          <CloseIcon />
        </button>
      </div>

      <div className="sheet-body">
        <div className={`sheet-crop ${plot.crop ? "" : "muted-bg"}`}>
          {plot.crop ? (
            <CropIcon crop={plot.crop} size={26} />
          ) : (
            <LandIcon size={26} />
          )}
        </div>
        <div className="sheet-meta">
          <strong>{title}</strong>
          <span className="muted small">{subtitle}</span>
          {progress !== null && (
            <div className="bar" aria-hidden>
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="sheet-actions">
        {action}
        <button className="btn plain" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  );
}
