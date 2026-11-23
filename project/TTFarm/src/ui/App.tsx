import { useEffect, useMemo, useState } from "react";
import { CROP_LIST, LEVEL_XP, levelFromXp, nextLevelXp } from "../game/crops";
import { AVATARS, useGame } from "../game/state";
import { observeHomeRevision, useAccount } from "../game/account";
import { startSocialSync, useSocial } from "../game/social";
import { startChatSync } from "../game/chat";
import { LoginPage } from "./LoginPage";
import { CoinIcon, CropIcon, LandIcon, LockIcon, SeedIcon, ShopIcon } from "./icons";
import { PlotSheet } from "./PlotSheet";
import { PlotAction } from "./PlotAction";
import { ShopPanel } from "./ShopPanel";
import { ProfilePanel } from "./ProfilePanel";
import { farmInput, releaseTouchInput } from "../game/input";
import { useDrive } from "../game/drive";
import { ControlGuide, DriveTouchControls, ReturnToLoginButton, TouchControls, WeatherBadge } from "./FieldControls";
import { ActionTrigger } from "./ActionPanel";
import { HudMenu } from "./HudMenu";
import { FarmPanel } from "./FarmPanel";
import { RanchPanel, RanchTrigger, RanchHUD } from "./RanchPanel";
import { ForageHUD } from "./ForageHUD";
import { Leaderboard, TrophyIcon } from "./Leaderboard";
import { FriendsPanel, FriendsTrigger, useFriendRoster } from "./FriendsPanel";
import { CodexPanel, CodexTrigger } from "./CodexPanel";
import { FarmGuests, VisitHUD } from "./VisitHUD";
import { ChatDock } from "./ChatDock";
import { MarketPanel } from "./MarketPanel";
import { CarStorePanel } from "./CarStorePanel";
import { TownHUD } from "./TownHUD";
import "./social.css";

export function App() {
  const token = useAccount(s => s.identityChecked && s.user?.nickname ? s.token : null);
  const nickname = useAccount(s => s.user?.nickname);
  const visit = useSocial(s => s.visit);
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
  const [ranchOpen, setRanchOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [carStoreOpen, setCarStoreOpen] = useState(false);
  const friendRoster = useFriendRoster(token, friendsOpen);
  useEffect(() => startSocialSync(observeHomeRevision), []);
  useEffect(() => startChatSync(), []);
  const away = !!visit;
  useEffect(() => {
    if (!away && token) return;
    setFriendsOpen(false); setRankingOpen(false); setShopOpen(false);
    setProfileOpen(false); setFarmOpen(false); setRanchOpen(false); setCodexOpen(false);
    setMarketOpen(false); setCarStoreOpen(false);
  }, [away, token]);

  // 打开页面时如果本地还留着登录票据，就去服务端拉一次最新存档（多端切换不至于读到旧进度）
  useEffect(() => {
    void useAccount.getState().refresh();
  }, []);

  const avatarId = useGame((s) => s.avatarId);
  const coins = useGame((s) => s.coins);
  const driving = useDrive((s) => s.driving);
  const xp = useGame((s) => s.xp);
  const seeds = useGame((s) => s.seeds);
  const selectedSeed = useGame((s) => s.selectedSeed);
  const selectSeed = useGame((s) => s.selectSeed);
  const selectedPlot = useGame((s) => s.selectedPlot);
  const toasts = useGame((s) => s.toasts);

  const panelOpen = !away && (shopOpen || profileOpen || farmOpen || ranchOpen || rankingOpen || friendsOpen || codexOpen || marketOpen || carStoreOpen);
  useEffect(() => {
    if (!panelOpen) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      setShopOpen(false); setProfileOpen(false); setFarmOpen(false); setRankingOpen(false);
      setRanchOpen(false); setFriendsOpen(false); setCodexOpen(false); setMarketOpen(false); setCarStoreOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [panelOpen]);
  useEffect(() => {
    farmInput.blocked = !token || panelOpen;
    releaseTouchInput();
    return () => { farmInput.blocked = true; };
  }, [token, panelOpen, away]);

  const level = levelFromXp(xp);
  const nextXp = nextLevelXp(level);
  const prevXp = LEVEL_XP[level - 1] ?? 0;
  const pct = nextXp ? Math.min(100, Math.max(0, ((xp - prevXp) / (nextXp - prevXp)) * 100)) : 100;
  const avatar = AVATARS.find((item) => item.id === avatarId) ?? AVATARS[0];

  // 种子栏顺序：有种子且已解锁 → 有种子但未解锁 → 没有种子（含未解锁）；
  // 第一组按数量从多到少，其余按解锁等级，最后按 id 保证刷新后顺序稳定。
  const seedRows = useMemo(() => CROP_LIST
    .filter((crop) => !crop.wild || (seeds[crop.id] ?? 0) > 0)
    .sort((a, b) => {
      const countA = seeds[a.id] ?? 0;
      const countB = seeds[b.id] ?? 0;
      const lockedA = level < a.unlockLevel;
      const lockedB = level < b.unlockLevel;
      const groupA = lockedA ? 2 : countA > 0 ? 0 : 1;
      const groupB = lockedB ? 2 : countB > 0 ? 0 : 1;
      if (groupA !== groupB) return groupA - groupB;
      if (groupA === 0) return countB - countA || a.unlockLevel - b.unlockLevel || a.id.localeCompare(b.id);
      return a.unlockLevel - b.unlockLevel || a.id.localeCompare(b.id);
    }), [seeds, level]);

  // 没登录就先只给登录页：3D 场景照样在背后转，登录完直接就是农场
  if (!token) return <LoginPage />;

  const menuItems = [
    { key: "codex", label: "图鉴", icon: "📖", onClick: () => setCodexOpen(true) },
    { key: "rank", label: "排行榜", icon: "🏆", onClick: () => setRankingOpen(true) },
    { key: "friends", label: "好友", icon: "👥", onClick: () => setFriendsOpen(true),
      hint: friendRoster.users?.filter(item => item.status === "incoming").length ? "有待处理" : undefined },
    { key: "weather", label: "天气 / 农场", icon: "🌤️", onClick: () => setFarmOpen(true) },
  ];

  return (
    <div className="hud" data-input={touchActive ? "touch" : "desktop"}>
      {visit ? <VisitHUD visit={visit}/> : <>
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
          <div className="hud-compact-hide top-tools">
            <CodexTrigger onClick={() => setCodexOpen(true)} />
            <button className="icon-btn rank-trigger" aria-label="金币排行榜" title="金币排行榜" onClick={() => setRankingOpen(true)}>
              <TrophyIcon /><span>排行</span>
            </button>
          </div>
          <div className="coin-pill" aria-label={`金币 ${coins}`}>
            <CoinIcon />
            <b>{coins.toLocaleString("zh-CN")}</b>
          </div>
          <button className="icon-btn labeled" onClick={() => setShopOpen(true)} aria-label="打开商店">
            <ShopIcon />
            <span>商店</span>
          </button>
          {!away && <HudMenu items={menuItems}>
            <div className="hud-menu-actions"><ActionTrigger /></div>
            <ControlGuide />
            <ReturnToLoginButton />
          </HudMenu>}
        </div>
      </header>

      <div className="field-status">
        {selectedPlot === null && <>
          <WeatherBadge onOpen={() => setFarmOpen(true)} />
          <ControlGuide />
          <ActionTrigger />
          <button type="button" className="ranch-trigger farm-trigger" aria-label="打开农场" onClick={() => setFarmOpen(true)}>
            <LandIcon /><b>农场</b>
          </button>
          <RanchTrigger onClick={() => setRanchOpen(true)} />
          <FriendsTrigger count={friendRoster.users?.filter(item => item.status === "incoming").length ?? 0} onClick={() => setFriendsOpen(true)}/>
        </>}
        <ReturnToLoginButton />
      </div>
      {selectedPlot === null && !panelOpen && <>
        <FarmGuests/>
        {driving ? <DriveTouchControls/> : <TouchControls/>}
        <PlotAction onOpenShop={() => setShopOpen(true)} />
        <RanchHUD onOpenRanch={() => setRanchOpen(true)} />
        <ForageHUD />
        <TownHUD onOpenMarket={() => setMarketOpen(true)} onOpenCarStore={() => setCarStoreOpen(true)} />
      </>}

      <div className="dock">
        <div className="dock-label">
          <SeedIcon />
          <span>种子</span>
        </div>
        <div className="seed-scroll">
          {/* 野菜种子只有捡到过才占格子，避免 20 个空位挤爆种子栏 */}
          {seedRows.map((crop) => {
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

      {!panelOpen && <PlotSheet onOpenFarm={() => setFarmOpen(true)} />}
      {shopOpen && <ShopPanel onClose={() => setShopOpen(false)} />}
      {marketOpen && <MarketPanel onClose={() => setMarketOpen(false)} />}
      {carStoreOpen && <CarStorePanel onClose={() => setCarStoreOpen(false)} />}
      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
      {farmOpen && <FarmPanel onClose={() => setFarmOpen(false)} />}
      {ranchOpen && <RanchPanel onClose={() => setRanchOpen(false)} />}
      {codexOpen && <CodexPanel onClose={() => setCodexOpen(false)} />}
      {rankingOpen && <Leaderboard token={token} onClose={() => setRankingOpen(false)} />}
      {friendsOpen && <FriendsPanel token={token} roster={friendRoster} onClose={() => setFriendsOpen(false)}/>}
      </>}

      <ChatDock />

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
