import { useState } from "react";
import { harvestLots, harvestValue } from "../game/crops";
import { meatLots } from "../game/market";
import { useGame } from "../game/state";
import "./varieties.css";
import { CloseIcon, CoinIcon, CropIcon } from "./icons";

/** 河岸售货大厅：蔬菜 / 肉品两栏，按批次卖或一次清空 */
export function MarketPanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const harvest = useGame((s) => s.harvest);
  const meat = useGame((s) => s.meat);
  const sellProduce = useGame((s) => s.sellProduce);
  const sellAll = useGame((s) => s.sellAll);
  const sellMeat = useGame((s) => s.sellMeat);
  const sellAllMeat = useGame((s) => s.sellAllMeat);
  const [tab, setTab] = useState<"produce" | "meat">("produce");

  const produce = harvestLots(harvest);
  const produceTotal = harvestValue(harvest);
  const meats = meatLots(meat);
  const meatTotal = meats.reduce((sum, lot) => sum + lot.price * lot.count, 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal market-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>河岸售货大厅</h2>
          <div className="coin-pill">
            <CoinIcon />
            <b>{coins.toLocaleString("zh-CN")}</b>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="modal-sub">河东的居民会来店里挑菜；卖掉的收成和肉品当场结账。</p>

        <div className="market-tabs">
          <button className={tab === "produce" ? "active" : ""} onClick={() => setTab("produce")}>
            蔬菜收成
            <span>{produceTotal > 0 ? `${produceTotal} 金币` : "空"}</span>
          </button>
          <button className={tab === "meat" ? "active" : ""} onClick={() => setTab("meat")}>
            肉品冷柜
            <span>{meatTotal > 0 ? `${meatTotal} 金币` : "空"}</span>
          </button>
        </div>

        {tab === "produce" ? (
          <>
            {produce.length > 0 ? (
              <ul className="list">
                {produce.map(({ key, crop, name, price, count, mutation }) => (
                  <li key={key} className="row">
                    <span className="row-icon"><CropIcon crop={crop.id} /></span>
                    <div className="row-main">
                      <strong className={mutation ? `variety-mark ${mutation}` : ""}>{name}</strong>
                      <span className="muted small">{price} 金币/份 · 共 {count * price} 金币</span>
                    </div>
                    <span className="owned">×{count}</span>
                    <button className="btn mini" onClick={() => sellProduce(key)}>卖出</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-tip">仓库里还没有蔬菜，先去农场收一茬</p>
            )}
            <div className="sell-bar">
              <div>
                <span className="muted small">全部蔬菜可卖</span>
                <strong className="sell-total">{produceTotal} 金币</strong>
              </div>
              <button className="btn primary" disabled={produceTotal <= 0} onClick={() => sellAll()}>
                卖出全部
              </button>
            </div>
          </>
        ) : (
          <>
            {meats.length > 0 ? (
              <ul className="list">
                {meats.map((lot) => (
                  <li key={lot.key} className="row">
                    <span className="row-icon meat-icon">🥩</span>
                    <div className="row-main">
                      <strong className={lot.element ? `variety-mark ${lot.element}` : ""}>{lot.name}</strong>
                      <span className="muted small">{lot.price} 金币/份 · 共 {lot.price * lot.count} 金币</span>
                    </div>
                    <span className="owned">×{lot.count}</span>
                    <button className="btn mini" onClick={() => sellMeat(lot.key, 1)}>卖 1</button>
                    <button className="btn mini" onClick={() => sellMeat(lot.key)}>全卖</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-tip">冷柜还是空的。去牧场把动物「出栏」，肉品会送到这里</p>
            )}
            <div className="sell-bar">
              <div>
                <span className="muted small">全部肉品可卖</span>
                <strong className="sell-total">{meatTotal} 金币</strong>
              </div>
              <button className="btn primary" disabled={meatTotal <= 0} onClick={() => sellAllMeat()}>
                卖出全部
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
