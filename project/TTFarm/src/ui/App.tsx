import { useState } from "react";
import { CROP_LIST, LEVEL_XP, levelFromXp, nextLevelXp } from "../game/crops";
import { AVATARS, useGame } from "../game/state";
import { CoinIcon, CropIcon, LandIcon, LockIcon, SeedIcon, ShopIcon } from "./icons";
import { PlotSheet } from "./PlotSheet";
import { ShopPanel } from "./ShopPanel";
import { ProfilePanel } from "./ProfilePanel";
import { FarmPanel } from "./FarmPanel";

export function App() {
  const [shopOpen, setShopOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [farmOpen, setFarmOpen] = useState(false);

  const nickname = useGame((s) => s.nickname);
  const avatarId = useGame((s) => s.avatarId);
  const coins = useGame((s) => s.coins);
  const xp = useGame((s) => s.xp);
  const seeds = useGame((s) => s.seeds);
  const selectedSeed = useGame((s) => s.selectedSeed);
  const selectSeed = useGame((s) => s.selectSeed);
  const selectedPlot = useGame((s) => s.selectedPlot);
  const toasts = useGame((s) => s.toasts);

  const level = levelFromXp(xp);
  const nextXp = nextLevelXp(level);
  const prevXp = LEVEL_XP[level - 1] ?? 0;
  const pct = nextXp ? Math.min(100, Math.max(0, ((xp - prevXp) / (nextXp - prevXp)) * 100)) : 100;
  const avatar = AVATARS.find((item) => item.id === avatarId) ?? AVATARS[0];

  return (
    <div className="hud">
      <header className="topbar">
        <button className="profile-chip" onClick={() => setProfileOpen(true)} aria-label="查看农场主资料">
          <img src={avatar.portrait} alt="" />
          <span className="profile-meta">
            <span className="profile-name">{nickname}</span>
            <span className="profile-sub">
              Lv{level}
              <span className="xp-track">
                <i style={{ width: `${pct}%` }} />
              </span>
            </span>
          </span>
        </button>

        <div className="top-right">
          <div className="coin-pill" aria-label={`金币 ${coins}`}>
            <CoinIcon />
            <b>{coins.toLocaleString("zh-CN")}</b>
          </div>
          <button className="icon-btn labeled" onClick={() => setFarmOpen(true)} aria-label="打开农场">
            <LandIcon />
            <span>农场</span>
          </button>
          <button className="icon-btn solid" onClick={() => setShopOpen(true)} aria-label="打开商店">
            <ShopIcon />
          </button>
        </div>
      </header>

      {selectedPlot === null && (
        <div className="hint">点击地块走过去 · WASD 走动 · 拖拽旋转视角 · 滚轮缩放 · 按 R 或双击画面复位</div>
      )}

      <div className="dock">
        <div className="dock-label">
          <SeedIcon />
          <span>种子</span>
        </div>
        <div className="seed-scroll">
          {CROP_LIST.map((crop) => {
            const locked = level < crop.unlockLevel;
            return (
              <button
                key={crop.id}
                className={`seed${selectedSeed === crop.id ? " active" : ""}${locked ? " locked" : ""}`}
                onClick={() => selectSeed(crop.id)}
              >
                <span className="seed-icon">
                  <CropIcon crop={crop.id} size={18} />
                </span>
                <span className="seed-text">
                  <span className="seed-name">{crop.name}</span>
                  <span className="seed-count">
                    {locked ? `Lv${crop.unlockLevel}` : `×${seeds[crop.id]}`}
                  </span>
                </span>
                {locked && <LockIcon size={12} />}
              </button>
            );
          })}
        </div>
        <button className="dock-shop" onClick={() => setShopOpen(true)} aria-label="打开商店">
          <ShopIcon />
        </button>
      </div>

      <PlotSheet onOpenShop={() => setShopOpen(true)} />
      {shopOpen && <ShopPanel onClose={() => setShopOpen(false)} />}
      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
      {farmOpen && <FarmPanel onClose={() => setFarmOpen(false)} />}

      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
