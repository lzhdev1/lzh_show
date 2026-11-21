import { landPriceOf, useGame } from "../game/state";
import { CloseIcon, LandIcon } from "./icons";

/** 点选未开垦地块时展示原有的顺序扩建入口。 */
export function PlotSheet({ onOpenFarm }: { onOpenFarm: () => void }) {
  const selectedPlot = useGame((s) => s.selectedPlot);
  const plots = useGame((s) => s.plots);
  const selectPlot = useGame((s) => s.selectPlot);
  const expand = useGame((s) => s.expand);
  if (selectedPlot === null || plots[selectedPlot]?.unlocked !== false) return null;

  const next = plots.find((plot) => !plot.unlocked);
  if (!next) return null;
  const canOpen = next.id === selectedPlot;
  const close = () => selectPlot(null);

  return (
    <div className="sheet" role="dialog" aria-label="开垦地块">
      <div className="sheet-head">
        <span className="plot-no">第 {selectedPlot + 1} 号地</span>
        <button className="icon-btn ghost" onClick={close} aria-label="关闭"><CloseIcon /></button>
      </div>
      <div className="sheet-body">
        <span className="sheet-crop muted-bg"><LandIcon size={26} /></span>
        <div className="sheet-meta">
          <strong>未开垦的地块</strong>
          <span className="muted small">
            {canOpen ? `开垦需要 ${landPriceOf(selectedPlot)} 金币` : `农田依次开垦，下一块是第 ${next.id + 1} 号地`}
          </span>
        </div>
      </div>
      <div className="sheet-actions">
        {canOpen
          ? <button className="btn primary" onClick={expand}><LandIcon />开垦这块地</button>
          : <button className="btn primary" onClick={() => { close(); onOpenFarm(); }}>打开农田管理</button>}
        <button className="btn plain" onClick={close}>关闭</button>
      </div>
    </div>
  );
}
