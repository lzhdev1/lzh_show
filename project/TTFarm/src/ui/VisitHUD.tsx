import { useEffect, useMemo, useRef, useState } from "react";
import { useClock } from "../game/clock";
import { CROP_LIST, harvestLots, produceName, CROPS, type CropId } from "../game/crops";
import { useFieldInteraction } from "../game/fieldInteraction";
import { formatRemain, guestWaterGate, isReady, plotMutationRevealed } from "../game/growth";
import { animalName, baitCount, isMountAnimal, ranchCapacity, type AnimalSpecies } from "../game/ranch";
import { useRanchInteraction } from "../game/ranchInteraction";
import { helpAtFarm, leaveVisit, useSocial, type Visit } from "../game/social";
import { kickGuest } from "../game/chat";
import { useAccount } from "../game/account";
import { useGame } from "../game/state";
import { ReturnToLoginButton, TouchControls } from "./FieldControls";
import { ActionTrigger } from "./ActionPanel";
import { FriendsIcon } from "./FriendsPanel";
import { HarvestIcon, SowIcon, WateringCanIcon } from "./icons";

interface RoomMember {
  id: string;
  nickname: string;
  isHost: boolean;
  isSelf: boolean;
  online: boolean;
}

/**
 * 房间成员：房主和来串门的玩家共用同一个入口。
 * 两人以内直接露名字；超过两人折叠成在线人数，点开才展开名单。
 */
export function RoomMembers({ includeSelf = true }: { includeSelf?: boolean }) {
  const players = useSocial(state => state.players);
  const visit = useSocial(state => state.visit);
  const user = useAccount(state => state.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const selfId = includeSelf && user ? String(user.id) : "";
  const hostId = visit?.ownerId ?? selfId;
  const hostName = visit?.ownerName ?? (includeSelf ? user?.nickname ?? "" : "");

  const members = useMemo(() => {
    const map = new Map<string, RoomMember>();
    if (hostId) {
      map.set(hostId, {
        id: hostId, nickname: hostName || "房主",
        isHost: true, isSelf: hostId === selfId,
        online: hostId === selfId || players.some(player => String(player.id) === hostId),
      });
    }
    if (selfId && user && !map.has(selfId)) {
      map.set(selfId, {
        id: selfId, nickname: user.nickname,
        isHost: selfId === hostId, isSelf: true, online: true,
      });
    }
    for (const player of players) {
      const id = String(player.id);
      if (map.has(id)) continue;
      map.set(id, { id, nickname: player.nickname, isHost: id === hostId, isSelf: id === selfId, online: true });
    }
    const order = (member: RoomMember) => member.isHost ? 0 : member.isSelf ? 1 : 2;
    return [...map.values()].sort((a, b) => order(a) - order(b) || a.nickname.localeCompare(b.nickname, "zh-CN"));
  }, [players, hostId, hostName, selfId, user]);

  useEffect(() => { setOpen(false); }, [visit?.ownerId]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  if (!members.length) return null;
  const online = members.filter(member => member.online).length;
  const compact = members.length > 2;
  const label = (member: RoomMember) => member.isHost && member.isSelf ? "房主（我）"
    : member.isHost ? `房主·${member.nickname}` : member.isSelf ? "我" : member.nickname;
  const summary = compact && !open ? `在线 ${online} 人` : members.map(label).join("、");
  const canKick = !visit;

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

  return <div className="room-members" ref={wrap} data-count={members.length}>
    <button type="button" className="room-member-trigger" aria-expanded={open} aria-haspopup="menu"
      aria-label={`房间成员，在线 ${online} 人`} onClick={() => setOpen(value => !value)}>
      <FriendsIcon/><span className="room-member-summary">{summary}</span>
      <span className="room-member-count" aria-hidden="true">{online}</span>
    </button>
    {open && <div className="room-member-list" role="menu" aria-label="房间成员">
      <div className="room-member-head">
        <b>房间成员</b><small>在线 {online} / {members.length} 人</small>
      </div>
      {members.map(member => <div key={member.id} className="room-member-row">
        <span className={`room-member-dot${member.online ? "" : " off"}`} aria-hidden="true"/>
        <span className="room-member-name">{member.nickname}</span>
        {(member.isHost || member.isSelf) && <em>{member.isHost && member.isSelf ? "房主 · 我"
          : member.isHost ? "房主" : "我"}</em>}
        {!member.online && <em className="off">离线</em>}
        {canKick && !member.isHost && !member.isSelf && <button type="button" disabled={busy === member.id}
          onClick={() => void kick(member.id, member.nickname)}>{busy === member.id ? "处理中…" : "请离"}</button>}
      </div>)}
    </div>}
  </div>;
}

export function GuestAction({ visit }: { visit: Visit }) {
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
  // 朋友每小时合计只能帮浇一次：被任何一位浇过后，这一小时其余人都不能再浇
  const gate = plot.crop && !ready ? guestWaterGate(plot, now) : null;
  const locked = Boolean(gate && !gate.ok);
  const lockedLabel = gate?.reason === "quota" && gate.waitMs
    ? `${formatRemain(gate.waitMs)}后可帮浇`
    : gate?.reason === "cap" ? "已浇足" : "浇水";
  return <div className="guest-action" role="group" aria-label="协作照料作物">
    <b>{produceName(CROPS[plot.crop], plotMutationRevealed(plot, now) ? plot.mutation : null)}</b>
    <button className="btn primary" disabled={busy || !present || (!ready && locked)}
      onClick={() => void run({ action: ready ? "harvest" : "water", plotId: plot.id }, ready ? "作物已收入好友的仓库" : "已为好友浇水")}>
      {ready ? <HarvestIcon size={22}/> : <WateringCanIcon size={22}/>}
      {ready ? "收获" : locked ? lockedLabel : "浇水"}
    </button>
  </div>;
}

export function FriendVisitInfo({ visit }: { visit: Visit }) {
  return <div className="friend-visit-info">
    <span className="friend-visit-icon" aria-hidden="true"><FriendsIcon/></span>
    <div className="friend-visit-text">
      <strong>{visit.ownerName}的农场</strong>
      <small>{visit.canManage ? "协作串门 · 消耗与收获都记在房主账上" : "自由游玩 · 未获协作授权"}</small>
    </div>
  </div>;
}

const MOUNT_EMOJI: Partial<Record<AnimalSpecies, string>> = {
  horse: "🐴", flameHorse: "🔥", wolf: "🐺", bear: "🐻", tiger: "🐯", lion: "🦁", elephant: "🐘", panda: "🐼",
};

/**
 * 坐骑按钮：自己农场与好友农场共用顶栏入口，位置固定在背包左侧。
 * 点击只打开自己已拥有的可骑动物列表，选一只才骑上去。
 */
function MountPicker() {
  const onFoot = useSocial(state => state.visitOnFoot);
  const visit = useSocial(state => state.visit);
  const ranch = useGame(state => state.ranch);
  const mounts = useMemo(() => ranch.animals.filter(isMountAnimal), [ranch.animals]);
  const mount = mounts.find(animal => animal.id === ranch.ridingId);
  const ridingMount = !visit || !onFoot ? mount : undefined;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => { if (mounts.length === 0) setOpen(false); }, [mounts.length]);

  const ride = (id: string) => {
    if (!useGame.getState().setRiding(id)) return;
    useSocial.setState({ visitOnFoot: false });
    setOpen(false);
  };
  const dismount = () => {
    if (useSocial.getState().visit) useSocial.setState({ visitOnFoot: true });
    else useGame.getState().setRiding(null);
    setOpen(false);
  };
  const toggle = () => {
    if (ridingMount) {
      dismount();
      return;
    }
    if (!mounts.length) {
      useGame.getState().notify("牧场还没有可骑的动物：收服野马，或让狼、熊、虎、狮子、大象、熊猫带上五行变异", "warn");
      return;
    }
    setOpen(value => !value);
  };
  const label = ridingMount ? "下坐骑" : "坐骑";
  const icon = ridingMount ? MOUNT_EMOJI[ridingMount.species] ?? "🐎" : "🐎";

  return <div className="mount-picker" ref={wrap}>
    <button type="button" className={`mount-toggle-top${mounts.length ? "" : " empty"}${ridingMount ? " riding" : ""}`}
      onClick={toggle} aria-haspopup={ridingMount ? undefined : "menu"} aria-expanded={ridingMount ? undefined : open}
      aria-label={ridingMount ? `下坐骑，结束骑乘${animalName(ridingMount)}`
        : mounts.length ? `坐骑，已拥有 ${mounts.length} 只可骑动物` : "坐骑，暂无可用动物"}
      title={ridingMount ? `点击下坐骑，结束骑乘${animalName(ridingMount)}`
        : mounts.length ? `点击选择坐骑，共 ${mounts.length} 只` : "还没有可骑的动物"}>
      <span className="mount-toggle-icon" aria-hidden="true">{icon}</span>
      <span className="mount-toggle-label">{label}</span>
    </button>
    {open && !ridingMount && <div className="mount-picker-menu" role="menu" aria-label="我的坐骑">
      <div className="mount-picker-head"><b>我的坐骑</b><small>{mounts.length} 只</small></div>
      {mounts.map(animal => <button key={animal.id} type="button" role="menuitem"
        className={`mount-picker-item${animal.id === ranch.ridingId && ridingMount ? " active" : ""}`}
        onClick={() => ride(animal.id)}>
        <span className="mount-picker-icon" aria-hidden="true">{MOUNT_EMOJI[animal.species] ?? "🐾"}</span>
        <span className="mount-picker-copy">
          <strong>{animalName(animal)}</strong>
          <small>{animal.element ? "五行变异坐骑" : "牧场坐骑"}</small>
        </span>
        {animal.id === ranch.ridingId && ridingMount && <em>骑乘中</em>}
      </button>)}
    </div>}
  </div>;
}

export function MountButton() {
  return <MountPicker/>;
}

/** 回家按钮：紧挨功能菜单左侧。 */
export function FriendHomeButton() {
  return <button type="button" className="friend-visit-home friend-home-top" onClick={leaveVisit}>回家</button>;
}

/** 好友串门时仍需显示协作卡与重连提示，但不参与顶栏排布。 */
export function FriendVisitOverlay({ visit }: { visit: Visit }) {
  const reconnecting = useSocial(state => state.reconnecting);
  return <>
    {reconnecting && <p className="friend-visit-reconnect" role="status">正在重新连接农场…</p>}
    {visit.canManage && !reconnecting && <GuestAction visit={visit}/>}
  </>;
}

export function VisitHUD({ visit }: { visit: Visit }) {
  const reconnecting = useSocial(state => state.reconnecting);
  const spectator = visit.mode === "spectate";
  const focus = (area: "farm" | "ranch") => window.dispatchEvent(new CustomEvent("ttfarm:visit-focus", { detail: area }));
  return <div className="visit-hud">
    <header className="visit-header">
      <div className="visit-identity"><span className="visit-icon"><FriendsIcon/></span><div>
        <strong>{visit.ownerName}的农场</strong>
        <small>{spectator ? "排行榜参观 · 自由镜头" : visit.canManage ? "好友串门 · 已获协作授权" : "好友串门 · 自由游玩"}</small>
      </div></div>
      <div className="visit-exits">
        <RoomMembers includeSelf={false}/>
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
      <div className="visit-tools">
        <ActionTrigger/>
      </div>
      {visit.canManage && !reconnecting && <GuestAction visit={visit}/>}
    </>}
    <TouchControls spectating={spectator}/>
  </div>;
}
