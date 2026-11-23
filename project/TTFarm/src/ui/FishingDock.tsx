import { useEffect, useState, type CSSProperties } from "react";
import { FISH_RARITY, fishById, rodById } from "../game/fish";
import { BAITS, baitById } from "../game/items";
import { ballPosition, describeFishingPhase, useFishing } from "../game/fishing";
import { useGame } from "../game/state";
import { unlockFishingAudio } from "../scene/fishingAudio";
import { FishPortrait } from "./FishPortrait";
import { CloseIcon } from "./icons";
import "./fishing.css";

function RodIcon({ size = 26 }: { size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21 19 4" stroke="#f7f3df" strokeWidth="1.8" />
    <path d="M19 4c2 2.4 2.2 5.8.3 8.4" stroke="#f7f3df" strokeWidth="1.2" opacity=".8" />
    <path d="M19.2 6.4c1.1 6.4-3.5 11-9.8 11.6" stroke="#d9e6d0" strokeWidth=".9" opacity=".7" />
    <path d="M9.4 18c-.9 1.4-.7 2.4.6 2.6" stroke="#f7f3df" strokeWidth="1" />
    <circle cx="8.2" cy="15.8" r="1.7" stroke="#d9e6d0" strokeWidth="1.2" />
    <path d="M6.7 19.5 8 21.4" stroke="#d9e6d0" strokeWidth="1.3" />
  </svg>;
}

function FishGlyph({ size = 22 }: { size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.8 12c3-4.3 8.1-5 11.2-1.4 1.2 1.4 1.8 2.5 3.6 3-1 1.4-1.4 2.6-3.6 3-3.2 3-8.3 2.2-11.2-1.6Z" stroke="#3e5a4b" strokeWidth="1.2" fill="#dcebd7" />
    <path d="M3.8 12 1.6 8.8 2.3 13.4 1.7 16.1Z" stroke="#3e5a4b" strokeWidth="1.1" fill="#b9d5b4" />
    <circle cx="13.1" cy="10.7" r=".8" fill="#22352c" />
  </svg>;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

export function FishingDock() {
  const rodId = useGame((s) => s.fishingRod);
  const selectedBait = useGame((s) => s.selectedBait);
  const materials = useGame((s) => s.materials);
  const selectBait = useGame((s) => s.selectBait);
  const phase = useFishing((s) => s.phase);
  const near = useFishing((s) => s.nearRiver);
  const banner = useFishing((s) => s.banner);
  const fishId = useFishing((s) => s.fishId);
  const zoneStart = useFishing((s) => s.zoneStart);
  const zoneWidth = useFishing((s) => s.zoneWidth);
  const ballSpeed = useFishing((s) => s.ballSpeed);
  const reelAt = useFishing((s) => s.reelAt);
  const biteStart = useFishing((s) => s.biteStart);
  const result = useFishing((s) => s.result);
  const cast = useFishing((s) => s.cast);
  const lift = useFishing((s) => s.lift);
  const closeResult = useFishing((s) => s.closeResult);

  const active = phase === "casting" || phase === "waiting" || phase === "bite" || phase === "reeling";
  const now = useNow(active || phase === "result");
  const rod = rodById(rodId);
  const fish = fishById(fishId);
  const bait = baitById(selectedBait);
  const baitCount = bait ? materials[bait.id] ?? 0 : 0;
  const [baitOpen, setBaitOpen] = useState(false);

  if (!rod) return null;

  const click = () => {
    unlockFishingAudio();
    setBaitOpen(false);
    if (phase === "idle" || phase === "result") cast();
    else lift();
  };

  const biteLeft = phase === "bite" ? Math.max(0, 5 - (now - biteStart) / 1000) : 0;
  const reelLeft = phase === "reeling" ? Math.max(0, 30 - (now - reelAt) / 1000) : 0;
  const ball = phase === "reeling" ? ballPosition(now - reelAt, ballSpeed) : 0;

  return <>
    <div className={`fishing-dock${phase === "bite" ? " bite" : ""}${phase === "reeling" ? " reeling" : ""}`}>
      {(phase === "waiting" || phase === "bite" || phase === "reeling" || !near) && <div className={`fishing-hint${phase === "bite" ? " urgent" : ""}`}>
        {!near && phase === "idle" ? "靠近河岸才能下竿" : phase === "waiting" ? "浮漂在轻轻点动，等它真正沉下去" :
          phase === "bite" ? `咬钩！${biteLeft.toFixed(1)} 秒内提竿` :
          phase === "reeling" ? `${reelLeft.toFixed(1)} 秒内把小球对准亮区` : ""}
      </div>}
      {phase === "idle" && near && <div className="fishing-hint soft">{banner || `${rod.name}在手${bait ? ` · ${bait.name}${baitCount > 0 ? ` ×${baitCount}` : "（已用完）"}` : " · 空钩"}`}</div>}
      {phase === "casting" && <div className="fishing-hint soft">抛竿线正在出水……</div>}

      {baitOpen && (phase === "idle" || phase === "result") && (
        <div className="fishing-bait-pop" role="dialog" aria-label="选择鱼饵">
          <div className="fishing-bait-head">
            <strong>选择鱼饵</strong>
            <button type="button" onClick={() => setBaitOpen(false)} aria-label="收起鱼饵选择"><CloseIcon size={14} /></button>
          </div>
          <button
            type="button"
            className={`fishing-bait-option${selectedBait === null ? " active" : ""}`}
            onClick={() => { selectBait(null); setBaitOpen(false); }}
          >
            <span className="fishing-bait-dot no-bait" />
            <span><b>不用鱼饵</b><small>空钩可以抛竿，但不会有鱼咬钩</small></span>
          </button>
          {BAITS.map((item) => {
            const count = materials[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                className={`fishing-bait-option${selectedBait === item.id ? " active" : ""}${count <= 0 ? " empty" : ""}`}
                onClick={() => { selectBait(item.id); setBaitOpen(false); }}
              >
                <span className="fishing-bait-dot" style={{ background: item.color }} />
                <span><b>{item.name}<i>×{count}</i></b><small>{item.target}</small></span>
              </button>
            );
          })}
        </div>
      )}

      <div className="fishing-controls">
        <button
          type="button"
          className={`fishing-bait-small${bait && baitCount > 0 ? "" : " empty"}`}
          onClick={() => setBaitOpen((open) => !open)}
          disabled={active}
          aria-label="选择鱼饵"
          title={bait ? `${bait.name} ×${baitCount}` : "选择鱼饵"}
        >
          {bait ? <span className="fishing-bait-dot" style={{ background: bait.color }} /> : <span className="fishing-bait-dot no-bait" />}
          <small>{bait ? bait.short : "空钩"}</small>
        </button>
        <button type="button" className={`fishing-button phase-${phase}${near || phase !== "idle" ? "" : " dim"}`}
          onClick={click} disabled={phase === "casting"} aria-label={describeFishingPhase(phase)}>
          <span className="fishing-button-icon">
            {phase === "bite" || phase === "reeling" ? <FishGlyph size={28}/> : <RodIcon size={30}/>}
          </span>
          <span className="fishing-button-label">
            {phase === "idle" ? "钓鱼" : phase === "casting" ? "抛竿" : phase === "waiting" ? "收竿" : phase === "bite" ? "提竿" : phase === "reeling" ? "起竿" : "渔获"}
          </span>
          {(phase === "bite" || phase === "reeling") && <i className="fishing-button-ring" />}
          {phase === "bite" && <span className="fishing-bite-badge">咬钩！</span>}
        </button>
      </div>
      {phase === "idle" && <small className="fishing-rod-name">{rod.name}</small>}
    </div>

    {phase === "reeling" && <section className="fishing-qte" data-tension={Math.min(1, (now - reelAt) / 4000)} aria-label="遛鱼时机">
      <div className="fishing-qte-head">
        <span className="qte-title">遛鱼</span>
        <span className="qte-fish">{fish?.name}</span>
        <b className={`qte-timer${reelLeft < 8 ? " low" : ""}`}>{reelLeft.toFixed(1)}s</b>
      </div>
      <div className="qte-track">
        <div className="qte-water" />
        <div className="qte-zone" style={{ left: `${zoneStart * 100}%`, width: `${zoneWidth * 100}%` }}>
          <span />
        </div>
        <div className="qte-ball" style={{ left: `${ball * 100}%` }} />
        <div className="qte-tension"><i style={{ width: `${Math.min(100, ((now - reelAt) / 4000) * 100)}%` }} /></div>
      </div>
      <div className="fishing-qte-foot">
        <span>小球进入金色亮区时，再点右下角「起竿」</span>
        <span className="qte-rod">{rod.name}</span>
      </div>
    </section>}

    {near && phase === "idle" && <div className="fishing-water-tip" aria-hidden="true">
      <span>水面有鱼影</span><i /><i /><i />
    </div>}

    {phase === "result" && result && (
      <FishingResultModal ok={result.ok} fishId={result.fishId} length={result.length} weight={result.weight}
        reason={result.reason} fishCount={result.fishId ? useGame.getState().fishCaught[result.fishId] ?? 0 : 0}
        onClose={closeResult} />
    )}
  </>;
}

export function FishingResultModal({ ok, fishId, length, weight, reason, fishCount, onClose }: {
  ok: boolean; fishId: string | null; length: number; weight: number; reason: string; fishCount: number; onClose: () => void;
}) {
  const fish = fishById(fishId);
  const rarity = fish ? FISH_RARITY[fish.rarity] : null;
  return <div className="modal-scrim fishing-result-scrim" onClick={onClose}>
    <section className={`modal fishing-result${ok ? " success" : " escaped"}`} role="dialog" aria-modal="true"
      aria-label={ok ? "渔获" : "脱钩"} onClick={(event) => event.stopPropagation()}>
      <div className="fishing-result-head">
        <span className={`fishing-result-stamp${ok ? " success" : ""}`}>{ok ? "渔获上钩" : "脱钩"}</span>
        {rarity && <span className={`fishing-rarity rarity-${fish!.rarity}`} style={{ "--rarity": rarity.color } as CSSProperties}>{rarity.label}</span>}
        <button className="icon-btn ghost" onClick={onClose} aria-label="关闭渔获"><CloseIcon /></button>
      </div>
      {fish ? <>
        <div className={`fishing-result-stage${ok ? "" : " dim"}`}>
          <div className="fishing-result-glow" style={{ "--rarity": rarity?.color ?? "#9bb5a4" } as CSSProperties} />
          <FishPortrait fish={fish} size={232} dim={!ok} />
          {!ok && <span className="fishing-escaped-mark">脱钩</span>}
        </div>
        <h2 className="fishing-result-name">{ok ? fish.name : "鱼跑了"}</h2>
        {ok ? <div className="fishing-result-stats">
          <span><small>体长</small><b>{length.toFixed(2)} m</b></span>
          <span><small>估重</small><b>{weight.toFixed(2)} kg</b></span>
          <span><small>售价</small><b><i className="coin-dot" />{fish.price}</b></span>
          <span><small>鱼篓</small><b>{fishCount} 条</b></span>
        </div> : <p className="fishing-result-reason">{reason}</p>}
        <p className="fishing-result-blurb">{fish.blurb}</p>
        <p className="fishing-result-effect"><b>用途</b>{fish.effect}</p>
      </> : <>
        <h2 className="fishing-result-name">脱钩</h2>
        <p className="fishing-result-reason">{reason || "水下突然一轻，鱼跑了"}</p>
      </>}
      <div className="fishing-result-actions">
        <button type="button" className="fishing-result-primary" onClick={onClose}>{ok ? "收入鱼篓 · 继续钓" : "重新抛竿"}</button>
      </div>
    </section>
  </div>;
}
