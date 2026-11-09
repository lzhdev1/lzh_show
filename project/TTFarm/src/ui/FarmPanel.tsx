import { useState } from "react";
import { PLOT_COUNT, landPriceOf, useGame } from "../game/state";
import { CloseIcon, CoinIcon, LandIcon } from "./icons";

const money = (value: number) => value.toLocaleString("zh-CN");

/** 农场面板：目前只放扩建，能一次选好几块地一起扩建 */
export function FarmPanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const plots = useGame((s) => s.plots);
  const expandBy = useGame((s) => s.expandBy);

  const unlocked = plots.filter((p) => p.unlocked).length;
  const locked = plots.filter((p) => !p.unlocked);
  const maxCount = Math.min(locked.length, 10);
  const [count, setCount] = useState(locked.length > 0 ? 1 : 0);

  const chosen = locked.slice(0, Math.max(count, 0));
  const cost = chosen.reduce((sum, p) => sum + landPriceOf(p.id), 0);

  const step = (delta: number) => {
    setCount((prev) => Math.min(maxCount, Math.max(locked.length > 0 ? 1 : 0, prev + delta)));
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>农场</h2>
          <div className="coin-pill">
            <CoinIcon />
            <b>{money(coins)}</b>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="modal-sub">
          共 {PLOT_COUNT} 块地，已开垦 {unlocked} 块{locked.length > 0 ? `，还有 ${locked.length} 块待扩建` : "，全部开垦完毕"}
        </p>

        <h3 className="section-title">扩建</h3>
        {locked.length > 0 ? (
          <>
            <div className="expand-card">
              <span className="row-icon">
                <LandIcon />
              </span>
              <div className="row-main">
                <strong>扩建地块</strong>
                <span className="muted small">
                  {locked.length > 1 ? `一次最多扩 ${maxCount} 块` : "只剩最后一块地"} · 按开垦顺序推进
                </span>
              </div>
              <div className="stepper" role="group" aria-label="扩建数量">
                <button className="stepper-btn" onClick={() => step(-1)} disabled={count <= 1} aria-label="减少">
                  −
                </button>
                <span className="stepper-value">{count}</span>
                <button className="stepper-btn" onClick={() => step(1)} disabled={count >= maxCount} aria-label="增加">
                  +
                </button>
              </div>
            </div>

            <div className="sell-bar">
              <div>
                <span className="muted small">预计花费</span>
                <strong className="sell-total">
                  {money(cost)} 金币
                  {cost > coins ? "（不够）" : ""}
                </strong>
              </div>
              <button
                className="btn primary"
                disabled={cost > coins || count <= 0}
                onClick={() => {
                  const ok = expandBy(count);
                  if (ok) setCount(locked.length - count > 0 ? 1 : 0);
                }}
              >
                扩建 {count} 块
              </button>
            </div>
          </>
        ) : (
          <p className="empty-tip">所有地块都开垦完了，接下来专心种菜就好</p>
        )}

        <h3 className="section-title">地块一览</h3>
        <div className="plot-grid">
          {plots.map((plot) => (
            <span key={plot.id} className={`plot-chip${plot.unlocked ? " on" : ""}`}>
              {plot.id + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
