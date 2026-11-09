import { CROP_LIST, levelFromXp } from "../game/crops";
import { useGame } from "../game/state";
import { CloseIcon, CoinIcon, CropIcon } from "./icons";

function formatGrow(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} 秒`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} 分钟` : `${m} 分 ${s} 秒`;
}

export function ShopPanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const seeds = useGame((s) => s.seeds);
  const harvest = useGame((s) => s.harvest);
  const xp = useGame((s) => s.xp);
  const buySeed = useGame((s) => s.buySeed);
  const sellAll = useGame((s) => s.sellAll);

  const level = levelFromXp(xp);
  const total = CROP_LIST.reduce((sum, crop) => sum + harvest[crop.id] * crop.sellPrice, 0);
  const hasHarvest = CROP_LIST.some((crop) => harvest[crop.id] > 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>农场商店</h2>
          <div className="coin-pill">
            <CoinIcon />
            <b>{coins.toLocaleString('zh-CN')}</b>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="modal-sub">买种子、卖收成，扩建地块去「农场」</p>

        <h3 className="section-title">种子</h3>
        <ul className="list">
          {CROP_LIST.map((crop) => {
            const locked = level < crop.unlockLevel;
            return (
              <li key={crop.id} className={locked ? "row locked" : "row"}>
                <span className="row-icon">
                  <CropIcon crop={crop.id} />
                </span>
                <div className="row-main">
                  <strong>{crop.name}</strong>
                  <span className="muted small">
                    {crop.seedPrice} 金币 · {formatGrow(crop.growMs)}成熟
                    {locked ? ` · Lv${crop.unlockLevel} 解锁` : ""}
                  </span>
                </div>
                <span className="owned">×{seeds[crop.id]}</span>
                <button className="btn mini" onClick={() => buySeed(crop.id)}>
                  买 1
                </button>
              </li>
            );
          })}
        </ul>

        <h3 className="section-title">收成</h3>
        {hasHarvest ? (
          <ul className="list">
            {CROP_LIST.filter((crop) => harvest[crop.id] > 0).map((crop) => (
              <li key={crop.id} className="row">
                <span className="row-icon">
                  <CropIcon crop={crop.id} />
                </span>
                <div className="row-main">
                  <strong>{crop.name}</strong>
                  <span className="muted small">
                    {crop.sellPrice} 金币/份 · 共 {harvest[crop.id] * crop.sellPrice} 金币
                  </span>
                </div>
                <span className="owned">×{harvest[crop.id]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-tip">还没有可卖的菜，先去种一茬</p>
        )}

        <div className="sell-bar">
          <div>
            <span className="muted small">全部收成可卖</span>
            <strong className="sell-total">{total} 金币</strong>
          </div>
          <button className="btn primary" disabled={total <= 0} onClick={() => sellAll()}>
            卖出全部
          </button>
        </div>
      </div>
    </div>
  );
}
