import { useState } from "react";
import { CAR_MODELS, CAR_PAINTS } from "../game/garage";
import { useGame } from "../game/state";
import "./varieties.css";
import { CloseIcon, CoinIcon } from "./icons";

/** 星野汽车展厅：选车型、挑车漆，付金币提车进车库 */
export function CarStorePanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const garage = useGame((s) => s.garage);
  const buyCar = useGame((s) => s.buyCar);
  const [paint, setPaint] = useState(0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal carstore-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>星野汽车</h2>
          <div className="coin-pill">
            <CoinIcon />
            <b>{coins.toLocaleString("zh-CN")}</b>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="modal-sub">展厅里三台现车都能试坐。提车后点右下角「驾驶」，选一台开出去。</p>

        <div className="paint-row" role="group" aria-label="车漆">
          <span className="muted small">车漆</span>
          {CAR_PAINTS.map((item, index) => (
            <button
              key={item.name}
              type="button"
              className={`paint-dot${paint === index ? " active" : ""}`}
              style={{ background: `#${item.hex.toString(16).padStart(6, "0")}` }}
              title={item.name}
              aria-label={item.name}
              aria-pressed={paint === index}
              onClick={() => setPaint(index)}
            />
          ))}
          <b className="paint-name">{CAR_PAINTS[paint].name}</b>
        </div>

        <ul className="car-list">
          {CAR_MODELS.map((model) => {
            const owned = garage.cars.filter((car) => car.model === model.id).length;
            const full = garage.cars.length >= 6;
            const poor = coins < model.price;
            return (
              <li key={model.id} className="car-card">
                <div className="car-preview" style={{ background: `#${CAR_PAINTS[paint].hex.toString(16).padStart(6, "0")}` }}>
                  <span className="car-preview-window" />
                  <span className={`car-preview-body ${model.id}`} />
                  <span className="car-preview-wheel left" />
                  <span className="car-preview-wheel right" />
                </div>
                <div className="car-info">
                  <strong>{model.name}</strong>
                  <span className="muted small">{model.tagline}</span>
                  <span className="car-stats">
                    <span>极速 {model.speed} m/s</span>
                    <span>操控 {model.handling.toFixed(2)}</span>
                    {owned > 0 && <span>已有 {owned} 台</span>}
                  </span>
                </div>
                <div className="car-buy">
                  <span className="car-price">{model.price.toLocaleString("zh-CN")} 金币</span>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={full || poor}
                    onClick={() => buyCar(model.id, CAR_PAINTS[paint].hex)}
                  >
                    {full ? "车库已满" : poor ? `还差 ${model.price - coins}` : "提车"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="empty-tip">车库 {garage.cars.length}/6 · 提车后可在驾驶面板切换</p>
      </div>
    </div>
  );
}
