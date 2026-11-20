import { useEffect, useState } from "react";
import { CROP_LIST, LEVEL_XP, levelFromXp, nextLevelXp } from "../game/crops";
import { AVATARS, useGame } from "../game/state";
import { useAccount } from "../game/account";
import { LoginPage } from "./LoginPage";
import { CoinIcon, CropIcon, LandIcon, LockIcon, SeedIcon, ShopIcon } from "./icons";
import { PlotSheet } from "./PlotSheet";
import { ShopPanel } from "./ShopPanel";
import { ProfilePanel } from "./ProfilePanel";
import { farmInput, releaseTouchInput } from "../game/input";
import { ControlGuide, TouchControls, WeatherBadge } from "./FieldControls";
import { FarmPanel } from "./FarmPanel";
import { Leaderboard, TrophyIcon } from "./Leaderboard";

export function App() {
  const token = useAccount((s) => s.token);
  const [touchActive, setTouchActive] = useState(() => matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const pointer = (event: PointerEvent) => setTouchActive(event.pointerType !== "mouse");
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLInputElement)) setTouchActive(false);
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  const [shopOpen, setShopOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [farmOpen, setFarmOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  // 打开页面时如果本地还留着登录票据，就去服务端拉一次最新存档（多端切换不至于读到旧进度）
  useEffect(() => {
    void useAccount.getState().refresh();
  }, []);

  const nickname = useGame((s) => s.nickname);
  const avatarId = useGame((s) => s.avatarId);
  const coins = useGame((s) => s.coins);
  const xp = useGame((s) => s.xp);
  const seeds = useGame((s) => s.seeds);
  const selectedSeed = useGame((s) => s.selectedSeed);
  const selectSeed = useGame((s) => s.selectSeed);
  const selectedPlot = useGame((s) => s.selectedPlot);
  const toasts = useGame((s) => s.toasts);

  const panelOpen = shopOpen || profileOpen || farmOpen || rankingOpen;
  useEffect(() => {
    if (!panelOpen) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      setShopOpen(false); setProfileOpen(false); setFarmOpen(false); setRankingOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [panelOpen]);
  useEffect(() => {
    farmInput.blocked = !token || panelOpen;
    releaseTouchInput();
    return () => { farmInput.blocked = true; };
  }, [token, panelOpen]);

  const level = levelFromXp(xp);
  const nextXp = nextLevelXp(level);
  const prevXp = LEVEL_XP[level - 1] ?? 0;
  const pct = nextXp ? Math.min(100, Math.max(0, ((xp - prevXp) / (nextXp - prevXp)) * 100)) : 100;
  const avatar = AVATARS.find((item) => item.id === avatarId) ?? AVATARS[0];

  // 没登录就先只给登录页：3D 场景照样在背后转，登录完直接就是农场
  if (!token) return <LoginPage />;

  return (
    <div className="hud" data-input={touchActive ? "touch" : "desktop"}>
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
          <button className="icon-btn rank-trigger" aria-label="金币排行榜" title="金币排行榜" onClick={() => setRankingOpen(true)}>
            <TrophyIcon /><span>排行</span>
          </button>
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
        <>
          <div className="field-status"><WeatherBadge onOpen={() => setFarmOpen(true)} /><ControlGuide /></div>
          {!panelOpen && <TouchControls />}
        </>
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
      {rankingOpen && <Leaderboard token={token} onClose={() => setRankingOpen(false)} />}

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
