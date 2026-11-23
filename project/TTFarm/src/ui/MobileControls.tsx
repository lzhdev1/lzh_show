import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ACTIONS } from "../scene/actionMotion";
import { requestAction, requestStopAction, useAction } from "../game/actionStore";
import { BOOST_CARDS, BAITS, baitById } from "../game/items";
import { isReady } from "../game/growth";
import { useFishing } from "../game/fishing";
import { useGame } from "../game/state";
import { farmInput, setSprintEnabled, sprintEnabled, subscribeSprint } from "../game/input";
import { unlockFishingAudio } from "../scene/fishingAudio";
import { ItemIcon, CloseIcon } from "./icons";
import "./mobile-controls.css";

function RodMark() {
  return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 21 19 4" stroke="#f7f3df" strokeWidth="1.8" />
    <path d="M19 4c2 2.4 2.2 5.8.3 8.4M19.2 6.4c1.1 6.4-3.5 11-9.8 11.6" stroke="#d9e6d0" strokeWidth=".9" opacity=".8" />
    <circle cx="8.2" cy="15.8" r="1.7" stroke="#d9e6d0" strokeWidth="1.2" />
  </svg>;
}

function FishMark() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.8 12c3-4.3 8.1-5 11.2-1.4 1.2 1.4 1.8 2.5 3.6 3-1 1.4-1.4 2.6-3.6 3-3.2 3-8.3 2.2-11.2-1.6Z" stroke="#3e5a4b" strokeWidth="1.2" fill="#dcebd7" />
    <path d="M3.8 12 1.6 8.8 2.3 13.4 1.7 16.1Z" stroke="#3e5a4b" strokeWidth="1.1" fill="#b9d5b4" />
    <circle cx="13.1" cy="10.7" r=".8" fill="#22352c" />
  </svg>;
}

/** 手机右下角：一个大按钮加三个小按钮，从上方绕到左侧。 */
export function MobileControls() {
  const rodId = useGame(s => s.fishingRod);
  const materials = useGame(s => s.materials);
  const items = useGame(s => s.items);
  const selectedBait = useGame(s => s.selectedBait);
  const selectBait = useGame(s => s.selectBait);
  const selectedPlot = useGame(s => s.selectedPlot);
  const plots = useGame(s => s.plots);
  const useBoostCard = useGame(s => s.useBoostCard);
  const notify = useGame(s => s.notify);
  const phase = useFishing(s => s.phase);
  const cast = useFishing(s => s.cast);
  const lift = useFishing(s => s.lift);
  const current = useAction(s => s.current);
  const preferred = useAction(s => s.preferred);
  const preferredMeta = ACTIONS[preferred];
  const sprint = useSyncExternalStore(subscribeSprint, sprintEnabled, sprintEnabled);
  const [baitOpen, setBaitOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const longPress = useRef(false);
  const itemTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (itemTimer.current !== null) window.clearTimeout(itemTimer.current);
    setSprintEnabled(false);
    farmInput.brake = false;
  }, []);

  const rod = rodId;
  const bait = baitById(selectedBait);
  const baitCount = bait ? materials[bait.id] ?? 0 : 0;
  const ownedCards = BOOST_CARDS.filter(card => (items[card.id] ?? 0) > 0)
    .sort((a, b) => (items[b.id] ?? 0) - (items[a.id] ?? 0) || a.minutes - b.minutes);
  const pickedCard = itemId && (items[itemId] ?? 0) > 0 ? itemId : ownedCards[0]?.id ?? null;
  const baitChoices = [...BAITS].sort((a, b) => (materials[b.id] ?? 0) - (materials[a.id] ?? 0));
  const fishLabel = phase === "idle" ? "钓鱼" : phase === "casting" ? "抛竿" : phase === "waiting" ? "收竿"
    : phase === "bite" ? "提竿" : phase === "reeling" ? "起竿" : "渔获";

  const useItem = () => {
    if (!pickedCard) { notify("背包里没有加速卡，先去商店「道具」页买一张", "warn"); return; }
    const now = Date.now();
    const picked = selectedPlot !== null && plots[selectedPlot]?.crop && !isReady(plots[selectedPlot], now)
      ? selectedPlot
      : plots.find(plot => plot.crop && !isReady(plot, now))?.id;
    if (picked === undefined) { notify("没有正在生长的地块，先种一茬再用加速卡", "warn"); return; }
    useBoostCard(pickedCard, picked);
  };

  const clickMain = () => {
    if (rod) {
      unlockFishingAudio();
      setBaitOpen(false);
      setItemOpen(false);
      if (phase === "idle" || phase === "result") cast();
      else lift();
      return;
    }
    if (current === preferred) requestStopAction();
    else requestAction(preferred);
  };

  const pressItem = () => {
    if (rod) {
      setItemOpen(false);
      setBaitOpen(value => !value);
      return;
    }
    if (longPress.current) return;
    useItem();
  };

  return <div className="mobile-action-cluster">
    {(baitOpen || itemOpen) && <button type="button" className="cluster-pop-scrim" aria-label="收起选择"
      onClick={() => { setBaitOpen(false); setItemOpen(false); }} />}

    {baitOpen && rod && <div className="cluster-pop" role="dialog" aria-label="选择鱼饵">
      <div className="cluster-pop-head"><strong>选择鱼饵</strong>
        <button type="button" onClick={() => setBaitOpen(false)} aria-label="收起鱼饵选择"><CloseIcon size={13}/></button>
      </div>
      <button type="button" className={`cluster-option${selectedBait === null ? " active" : ""}`}
        onClick={() => { selectBait(null); setBaitOpen(false); }}>
        <span className="fishing-bait-dot no-bait" />
        <span><b>不用鱼饵</b><small>空钩可以抛竿，但鱼不会咬</small></span>
      </button>
      {baitChoices.map(baitItem => {
        const count = materials[baitItem.id] ?? 0;
        return <button key={baitItem.id} type="button"
          className={`cluster-option${selectedBait === baitItem.id ? " active" : ""}${count <= 0 ? " empty" : ""}`}
          onClick={() => { selectBait(baitItem.id); setBaitOpen(false); }}>
          <span className="fishing-bait-dot" style={{ background: baitItem.color }} />
          <span><b>{baitItem.name}<i>×{count}</i></b><small>{baitItem.target}</small></span>
        </button>;
      })}
    </div>}

    {itemOpen && !rod && <div className="cluster-pop item" role="dialog" aria-label="选择道具">
      <div className="cluster-pop-head"><strong>选择加速卡</strong>
        <button type="button" onClick={() => setItemOpen(false)} aria-label="收起道具选择"><CloseIcon size={13}/></button>
      </div>
      {ownedCards.length === 0 ? <p className="cluster-empty">背包里还没有加速卡</p> : ownedCards.map(card =>
        <button key={card.id} type="button" className={`cluster-option${pickedCard === card.id ? " active" : ""}`}
          onClick={() => { setItemId(card.id); setItemOpen(false); }}>
          <span className="cluster-item-icon"><ItemIcon size={19}/></span>
          <span><b>{card.name}<i>×{items[card.id] ?? 0}</i></b><small>{card.blurb}</small></span>
        </button>)}
    </div>}

    <button type="button" className={`cluster-key sprint${sprint ? " held" : ""}`}
      aria-pressed={sprint} aria-label={sprint ? "关闭冲刺，恢复常速" : "开启冲刺，移动时加速"}
      onClick={() => setSprintEnabled(!farmInput.sprint)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6Z" fill="#ffd97a" stroke="#fff0c4"/></svg>
      <span>{sprint ? "冲刺中" : "冲刺"}</span>
    </button>

    <button type="button" className="cluster-key jump" aria-label="跳跃"
      onPointerDown={event => { if (event.button === 0) farmInput.jump = true; }}
      onClick={event => { if (event.detail === 0) farmInput.jump = true; }}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6m-6-6v12M5 21h14"/></svg>
      <span>跳跃</span>
    </button>

    <button type="button" className={`cluster-key utility${rod ? " bait" : " item"}`}
      aria-label={rod ? "选择鱼饵" : "使用道具，长按选择加速卡"}
      onPointerDown={event => {
        if (event.button !== 0 || rod) return;
        longPress.current = false;
        itemTimer.current = window.setTimeout(() => {
          longPress.current = true;
          if (!ownedCards.length) notify("背包里没有加速卡", "warn");
          else setItemOpen(true);
        }, 480);
      }}
      onPointerUp={() => {
        if (itemTimer.current !== null) { window.clearTimeout(itemTimer.current); itemTimer.current = null; }
      }}
      onPointerCancel={() => {
        if (itemTimer.current !== null) { window.clearTimeout(itemTimer.current); itemTimer.current = null; }
        longPress.current = false;
      }}
      onClick={pressItem}>
      {rod
        ? <><span className={`utility-dot${bait && baitCount > 0 ? "" : " empty"}`} style={bait ? { background: bait.color } : undefined}/><span>{bait ? bait.short : "空钩"}</span></>
        : <><ItemIcon size={20}/><span>道具</span></>}
    </button>

    <button type="button" className={`fishing-button cluster-main${rod ? ` phase-${phase}` : ""}${current === preferred && !rod ? " action-on" : ""}`}
      onClick={clickMain} disabled={rod ? phase === "casting" : false}
      aria-label={rod ? fishLabel : preferredMeta.label}>
      <span className="fishing-button-icon">
        {rod ? (phase === "bite" || phase === "reeling" ? <FishMark/> : <RodMark/>) : <span className="cluster-action-emoji" aria-hidden="true">{preferredMeta.icon}</span>}
      </span>
      <span className="fishing-button-label">{rod ? fishLabel : preferredMeta.label}</span>
      {rod && phase === "bite" && <span className="fishing-bite-badge">咬钩！</span>}
      {rod && (phase === "bite" || phase === "reeling") && <i className="fishing-button-ring" />}
    </button>
  </div>;
}
