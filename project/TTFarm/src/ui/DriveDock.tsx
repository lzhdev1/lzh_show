import { useState } from "react";
import { carModelOf } from "../game/garage";
import { useDrive } from "../game/drive";
import { useGame } from "../game/state";
import { useTownNav } from "../game/townNav";
import "./drive.css";

/** 发言按钮上方的驾驶入口：展开车库列表，选车直接上路 */
export function DriveDock() {
  const [open, setOpen] = useState(false);
  const cars = useGame((s) => s.garage.cars);
  const activeId = useGame((s) => s.garage.activeId);
  const coins = useGame((s) => s.coins);
  const driving = useDrive((s) => s.driving);
  const start = useDrive((s) => s.start);
  const stop = useDrive((s) => s.stop);
  const requestDealer = useTownNav((s) => s.request);

  if (driving) {
    return (
      <div className="drive-dock">
        <button type="button" className="drive-toggle on" onClick={stop}>
          <span aria-hidden="true">◼</span><b>结束驾驶</b>
        </button>
      </div>
    );
  }

  return (
    <div className="drive-dock">
      {open && (
        <section className="drive-card" aria-label="我的车辆">
          <header className="drive-head">
            <b>我的车辆</b>
            <span className="muted small">{cars.length}/6</span>
          </header>
          {cars.length === 0 ? (
            <div className="drive-empty">
              <p>车库还空着。去河东「星野汽车」提一台。</p>
              <button type="button" className="drive-find" onClick={() => { requestDealer("dealer"); setOpen(false); }}>
                带我去星野汽车
              </button>
              <span className="drive-coins">现有 {coins.toLocaleString("zh-CN")} 金币</span>
            </div>
          ) : (
            <ul className="drive-list">
              {cars.map((car) => {
                const model = carModelOf(car.model);
                return (
                  <li key={car.id} className={`drive-row${car.id === activeId ? " active" : ""}`}>
                    <span className="drive-swatch" style={{ background: `#${car.color.toString(16).padStart(6, "0")}` }} />
                    <div className="drive-main">
                      <strong>{model.name} <span className="drive-plate">{car.plate}</span></strong>
                      <span className="muted small">极速 {model.speed} m/s · {model.tagline}</span>
                    </div>
                    <button type="button" className="btn mini" onClick={() => { start(car.id); setOpen(false); }}>驾驶</button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="drive-tip desktop-guide">W/S 油门刹车 · A/D 转向 · 空格手刹 · Shift 加速</p>
          <p className="drive-tip touch-guide">左侧前进 / 后退 · 右侧左转 / 右转</p>
        </section>
      )}
      <button type="button" className="drive-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span aria-hidden="true">🚗</span><b>驾驶</b>
      </button>
    </div>
  );
}
