import { useEffect, useState } from "react";
import { useClock } from "../game/clock";
import { CROP_LIST, harvestLots, produceName, CROPS, type CropId } from "../game/crops";
import { useFieldInteraction } from "../game/fieldInteraction";
import { formatRemain, isReady, MAX_WATER, remainingMs } from "../game/growth";
import { animalName, baitCount, isMountAnimal, ranchCapacity } from "../game/ranch";
import { useRanchInteraction } from "../game/ranchInteraction";
import { helpAtFarm, leaveVisit, useSocial, type Visit } from "../game/social";
import { kickGuest } from "../game/chat";
import { useGame } from "../game/state";
import { ReturnToLoginButton, TouchControls } from "./FieldControls";
import { ActionTrigger } from "./ActionPanel";
import { FriendsIcon } from "./FriendsPanel";
import { HarvestIcon, SowIcon, WateringCanIcon } from "./icons";

export function FarmGuests() {
  const players = useSocial(state => state.players);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!players.length) setOpen(false); }, [players.length]);
  if (!players.length) return null;
  const kick = async (id: string, nickname: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await kickGuest(id, nickname);
      useGame.getState().notify(`已请离 ${nickname}，5 分钟内不能再进你的农场`);
    } catch (error) {
      useGame.getState().notify(error instanceof Error ? error.message : "请离失败，稍后再试", "warn");
    } finally { setBusy(null); }
  };
  return <div className="farm-guests-wrap">
    <button type="button" className="farm-guests" aria-expanded={open}
      aria-label="查看在场访客" onClick={() => setOpen(value => !value)}>
      <FriendsIcon/><span>正在串门 · {players.map(player => player.nickname).join("、")}</span>
    </button>
    {open && <div className="farm-guest-list" role="menu" aria-label="在场访客">
      {players.map(player => <div key={player.id} className="farm-guest-row">
        <span>{player.nickname}</span>
        <button type="button" disabled={busy === player.id} onClick={() => void kick(player.id, player.nickname)}>
          {busy === player.id ? "处理中…" : "请离"}
        </button>
      </div>)}
    </div>}
  </div>;
}

function GuestAction({ visit }: { visit: Visit }) {
  const standing = useFieldInteraction(state => state.standingPlot);
  const nearby = useRanchInteraction(state => state.nearbyAnimal);
  const now = useClock(state => Math.floor(state.now / 1000) * 1000);
  const [cropChoice, setCropChoice] = useState<CropId>("radish");
  const [baitKey, setBaitKey] = useState("");
  const [busy, setBusy] = useState(false);
  const present = useSocial(state => state.present);
  const plot = visit.state.plots.find(item => item.id === standing);
  const run = async (action: Parameters<typeof helpAtFarm>[0], message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await helpAtFarm(action);
      if (useSocial.getState().visit?.ownerId === visit.ownerId) useGame.getState().notify(message);
    } catch (error) {
      if (useSocial.getState().visit?.ownerId === visit.ownerId)
        useGame.getState().notify(error instanceof Error ? error.message : "暂时无法协作", "warn");
    } finally { setBusy(false); }
  };

  if (nearby) {
    const lots = harvestLots(visit.state.harvest);
    const bait = lots.find(lot => lot.key === baitKey) ?? lots.find(lot => lot.count >= baitCount(nearby, lot.crop.id)) ?? lots[0];
    const needed = bait ? baitCount(nearby, bait.crop.id) : 0;
    const full = visit.state.ranch.animals.length >= ranchCapacity(visit.state.ranch.level);
    return <div className="guest-action" role="group" aria-label="协助牧场收服动物">
      <b>{animalName(nearby)}</b>
      {bait && !full && <select aria-label="选择主人的诱饵" value={bait.key} onChange={e => setBaitKey(e.target.value)}>
        {lots.map(lot => <option key={lot.key} value={lot.key}>{lot.name} ×{lot.count}（需 {baitCount(nearby, lot.crop.id)}）</option>)}
      </select>}
      <button className="btn primary" disabled={busy || !present || full || !bait || bait.count < needed}
        onClick={() => bait && void run({ action: "tame", animalId: nearby.id, baitKey: bait.key }, "已将动物送入好友的牧场")}>
        {full ? "好友牧场已满" : !bait || bait.count < needed ? "主人仓库中的诱饵不足" : `投喂 ${needed} 份并收服`}
      </button>
    </div>;
  }
  if (!plot?.unlocked) return null;
  if (!plot.crop) {
    const available = CROP_LIST.filter(crop => (visit.state.seeds[crop.id] ?? 0) > 0);
    const crop = available.find(item => item.id === cropChoice) ?? available[0];
    return <div className="guest-action" role="group" aria-label="协助播种">
      {crop && <select aria-label="选择主人的种子" value={crop.id} onChange={e => setCropChoice(e.target.value as CropId)}>
        {available.map(item => <option key={item.id} value={item.id}>{item.name}种子 ×{visit.state.seeds[item.id]}</option>)}
      </select>}
      <button className="btn primary" disabled={busy || !present || !crop}
        onClick={() => crop && void run({ action: "plant", plotId: plot.id, crop: crop.id }, "已为好友播种" + crop.name)}>
        <SowIcon size={22}/>{crop ? "撒种" : "主人暂时没有种子"}
      </button>
    </div>;
  }
  const ready = isReady(plot, now);
  const exhausted = plot.watered >= MAX_WATER;
  return <div className="guest-action" role="group" aria-label="协作照料作物">
    <b>{produceName(CROPS[plot.crop], plot.mutation)}</b>
    <button className="btn primary" disabled={busy || !present || (!ready && exhausted)}
      onClick={() => void run({ action: ready ? "harvest" : "water", plotId: plot.id }, ready ? "作物已收入好友的仓库" : "已为好友浇水")}>
      {ready ? <HarvestIcon size={22}/> : <WateringCanIcon size={22}/>}
      {ready ? "收获" : exhausted ? formatRemain(remainingMs(plot, now) ?? 0) + "后成熟" : "浇水"}
    </button>
  </div>;
}

export function VisitHUD({ visit }: { visit: Visit }) {
  const reconnecting = useSocial(state => state.reconnecting);
  const onFoot = useSocial(state => state.visitOnFoot);
  const ranch = useGame(state => state.ranch);
  const mount = ranch.animals.find(animal => animal.id === ranch.ridingId);
  // 没有正在骑的动物时，也允许从坐骑栏里挑一只——串门时不必回自己牧场先上马。
  const rideReady = mount ?? ranch.animals.find(isMountAnimal);
  const toggleRide = () => {
    if (!onFoot) { useSocial.setState({ visitOnFoot: true }); return; }
    if (!rideReady) {
      useGame.getState().notify("牧场还没有可骑的动物：收服野马，或让狼、熊、虎、狮子、大象、熊猫带上五行变异", "warn");
      return;
    }
    if (!mount && !useGame.getState().setRiding(rideReady.id)) return;
    useSocial.setState({ visitOnFoot: false });
  };
  const guestNames = useSocial(state => state.players.map(player => player.nickname).join("、"));
  const spectator = visit.mode === "spectate";
  const focus = (area: "farm" | "ranch") => window.dispatchEvent(new CustomEvent("ttfarm:visit-focus", { detail: area }));
  return <div className="visit-hud">
    <header className="visit-header">
      <div className="visit-identity"><span className="visit-icon"><FriendsIcon/></span><div>
        <strong>{visit.ownerName}的农场</strong>
        <small>{spectator ? "排行榜参观 · 自由镜头" : visit.canManage ? "好友串门 · 已获协作授权" : "好友串门 · 自由游玩"}</small>
      </div></div>
      <div className="visit-exits">
        <button className="visit-return" onClick={leaveVisit}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 8.6 10 2l8 6.6M4.5 7.7v9.6h11V7.7M8 17v-5h4v5"/></svg>回家
        </button>
        <ReturnToLoginButton />
      </div>
    </header>
    {reconnecting && <p className="visit-connection" role="status">正在重新连接农场…</p>}
    {spectator ? <nav className="visit-nav" aria-label="自由镜头">
      <div><button onClick={() => focus("farm")}>看农田</button><button onClick={() => focus("ranch")}>看牧场</button></div>
      <small className="desktop-guide">拖动环绕 · WASD 平移 · 滚轮缩放</small>
      <small className="touch-guide">滑动环绕 · 摇杆平移 · 双指缩放</small>
    </nav> : <>
      {guestNames && <div className="visit-company">同场 · {guestNames}</div>}
      <div className="visit-tools">
        <ActionTrigger/>
        <button className={`visit-ride${rideReady ? "" : " empty"}`} onClick={toggleRide}
          title={rideReady ? animalName(rideReady) : "还没有可骑的动物"}
          aria-label={onFoot ? (rideReady ? `召唤${animalName(rideReady)}` : "召唤坐骑") : "下坐骑"}>
          {onFoot ? (rideReady ? `召唤${animalName(rideReady)}` : "召唤坐骑") : `下坐骑 · ${animalName(mount!)}`}
        </button>
      </div>
      {visit.canManage && !reconnecting && <GuestAction visit={visit}/>}
    </>}
    <TouchControls spectating={spectator}/>
  </div>;
}
