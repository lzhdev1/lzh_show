import { useState } from "react";
import { FISHING_RODS, rodUnlocked, type FishingRod } from "../game/fish";
import { levelFromXp } from "../game/crops";
import { useGame } from "../game/state";
import { CloseIcon } from "./icons";
import "./fishing.css";

function RodArt({ rod, active }: { rod: FishingRod; active: boolean }) {
  return <svg className={`rod-art${active ? " active" : ""}`} viewBox="0 0 120 72" width="120" height="72" aria-hidden="true">
    <defs>
      <linearGradient id={`rod-${rod.id}`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor={rod.color} />
        <stop offset="1" stopColor={rod.accent} />
      </linearGradient>
    </defs>
    <path d="M10 64 C38 54 80 28 108 8" stroke={`url(#rod-${rod.id})`} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    <path d="M10 64 C38 54 80 28 108 8" stroke="#ffffff55" strokeWidth="1" fill="none" transform="translate(0 -1.2)" />
    <rect x="4" y="57" width="16" height="9" rx="4" fill="#5b4630" transform="rotate(-24 4 57)" />
    <circle cx="25" cy="56" r="5" fill="none" stroke="#e7e3cf" strokeWidth="1.5" />
    <path d="M25 56 21 52" stroke="#e7e3cf" strokeWidth="1.2" />
    <path d="M108 8 C108 30 94 48 72 54" stroke="#f5efd8" strokeWidth=".8" fill="none" opacity=".7" />
    <circle cx="72" cy="54" r="2.1" fill="#d94a34" />
    <path d="M38 38 34 37 M52 31 48 30 M66 23 62 22" stroke="#e7e3cf" strokeWidth="1.2" />
  </svg>;
}

export function FishingGearPanel({ onClose }: { onClose: () => void }) {
  const rodId = useGame((s) => s.fishingRod);
  const xp = useGame((s) => s.xp);
  const equip = useGame((s) => s.equipFishingRod);
  const level = levelFromXp(xp);
  const [picked, setPicked] = useState(() => rodId ?? FISHING_RODS[0].id);
  const rod = FISHING_RODS.find((item) => item.id === picked) ?? FISHING_RODS[0];
  const unlocked = rodUnlocked(rod, level);
  const equipped = rodId === rod.id;

  return <div className="modal-scrim fishing-gear-scrim" onClick={onClose}>
    <section className="modal fishing-gear-panel" role="dialog" aria-modal="true" aria-label="钓具屋" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <span className="fishing-gear-crest" aria-hidden="true">钓</span>
        <h2>河湾钓具屋</h2>
        <span className="fishing-level">农场 Lv{level}</span>
        <button className="icon-btn ghost" onClick={onClose} aria-label="关闭钓具屋"><CloseIcon /></button>
      </div>
      <p className="fishing-gear-intro">选一根顺手的竿。等级到了就自动解锁，不用再花金币；越好的竿，遛鱼时的金色亮区越宽。</p>
      <div className="fishing-rod-list">
        {FISHING_RODS.map((item) => {
          const open = rodUnlocked(item, level);
          const equippedItem = rodId === item.id;
          return <button type="button" key={item.id} className={`fishing-rod-card${picked === item.id ? " active" : ""}${open ? "" : " locked"}`}
            onClick={() => setPicked(item.id)} aria-pressed={picked === item.id}>
            <RodArt rod={item} active={picked === item.id} />
            <span className="rod-card-copy">
              <strong>{item.name}</strong>
              <small>Lv{item.level} · 抛距 {item.castRange.toFixed(1)} m</small>
              <small className="rod-bonus">高亮区 +{Math.round(item.zoneBonus * 100)}%</small>
            </span>
            {equippedItem ? <span className="rod-badge">已装备</span> : !open ? <span className="rod-badge lock">Lv{item.level}</span> : null}
          </button>;
        })}
      </div>
      <div className="fishing-rod-detail">
        <div>
          <h3>{rod.name}</h3>
          <p>{rod.blurb}</p>
        </div>
        <dl>
          <div><dt>高亮区</dt><dd>+{Math.round(rod.zoneBonus * 100)}%</dd></div>
          <div><dt>抛竿距离</dt><dd>{rod.castRange.toFixed(1)} m</dd></div>
          <div><dt>解锁</dt><dd>Lv{rod.level}</dd></div>
        </dl>
      </div>
      <div className="fishing-gear-actions">
        <button type="button" className="fishing-gear-equip" disabled={!unlocked || equipped}
          onClick={() => { if (equip(rod.id)) onClose(); }}>
          {equipped ? "已经装备" : unlocked ? `装备 ${rod.name}` : `农场到 Lv${rod.level} 后解锁`}
        </button>
      </div>
    </section>
  </div>;
}
