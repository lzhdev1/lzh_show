import { useMemo, useState, type CSSProperties } from "react";
import { CROPS, harvestLots } from "../game/crops";
import { animalName, ANIMALS, ANIMAL_ELEMENTS, baitCount, HORSE_SPEED_FACTOR, isMountAnimal, MOUNT_UNLOCK_LEVEL, ranchCapacity, ranchUpgradeCost, RANCH_MAX_LEVEL, type AnimalSpecies, type RanchAnimal, type WildAnimal } from "../game/ranch";
import { useRanchInteraction } from "../game/ranchInteraction";
import { useGame } from "../game/state";
import { CloseIcon, CoinIcon } from "./icons";
import "./ranch.css";

const portraits: Record<AnimalSpecies, string> = {
  wolf: "🐺", bear: "🐻", tiger: "🐯", lion: "🦁", elephant: "🐘", panda: "🐼", fox: "🦊",
  rabbit: "🐇", deer: "🦌", boar: "🐗", goat: "🐐", alpaca: "🦙", sheep: "🐑", horse: "🐴",
  cow: "🐄", raccoon: "🦝", redPanda: "🐾", penguin: "🐧", duck: "🦆", crane: "🪶",
};

function RanchIcon({ size = 23 }: { size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3.5 13.4 6-4.8 6.1 4.8v10.7H3.5z" fill="#cc9169" stroke="#7c5e3c" strokeWidth="1.5"/>
    <path d="m2 13.3 7.5-6.1 8 6.1" stroke="#4e7052" strokeWidth="2.4"/>
    <path d="M7 24v-7.2h5v7.1" fill="#fff2cc" stroke="#825e40" strokeWidth="1.2"/>
    <path d="M17 13.3v12.1m6.2-12.1v12.1m6.1-12.1v12.1m-13.1-9.3h13.4m-13.4 6h13.4" stroke="#855f3f" strokeWidth="2.3"/>
    <path d="M2.8 25.3h26.9" stroke="#83a35e" strokeWidth="2.4"/>
  </svg>;
}

function PawIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
    <ellipse cx="5.5" cy="9" rx="2.2" ry="3.1" transform="rotate(-24 5.5 9)"/>
    <ellipse cx="10" cy="5.6" rx="2.1" ry="3.1" transform="rotate(-8 10 5.6)"/>
    <ellipse cx="15.4" cy="5.9" rx="2.1" ry="3.1" transform="rotate(14 15.4 5.9)"/>
    <ellipse cx="19.1" cy="10.2" rx="2.1" ry="3" transform="rotate(27 19.1 10.2)"/>
    <path d="M6 15.3c2.2-2.6 3.8-5.5 6.4-5.1 2.4.3 3.1 2.8 5.3 5.6 1.9 2.9-.2 5-2.8 4.3-2.1-.7-3.7-1.2-5.4-.4-3.2 1-5.6-1.1-3.5-4.4Z"/>
  </svg>;
}

export function RanchTrigger({ onClick }: { onClick: () => void }) {
  return <button type="button" className="ranch-trigger" aria-label="打开牧场" onClick={onClick}>
    <RanchIcon /><b>牧场</b>
  </button>;
}

function AnimalPortrait({ animal }: { animal: RanchAnimal }) {
  const tint = animal.element ? ANIMAL_ELEMENTS[animal.element].color : "#dce4bd";
  return <span className="animal-portrait" style={{ "--animal-tint": tint } as CSSProperties} aria-hidden="true">
    {portraits[animal.species]}
  </span>;
}

function WildEncounter({ animal, onOpenRanch }: { animal: WildAnimal; onOpenRanch: () => void }) {
  const harvest = useGame((game) => game.harvest);
  const ranch = useGame((game) => game.ranch);
  const tame = useGame((game) => game.tameWild);
  const lots = useMemo(() => harvestLots(harvest).map((lot) => ({ ...lot, needed: baitCount(animal, lot.crop.id) }))
    .sort((a, b) => Number(b.count >= b.needed) - Number(a.count >= a.needed) || a.price * a.needed - b.price * b.needed), [harvest, animal]);
  const [choice, setChoice] = useState("");
  const bait = lots.find((lot) => lot.key === choice) ?? lots[0];
  const full = ranch.animals.length >= ranchCapacity(ranch.level);
  const favorite = CROPS[ANIMALS[animal.species].favorite].name;
  return <div className="wild-encounter" role="group" aria-label="投喂野生动物">
    <div className="wild-encounter-head">
      <AnimalPortrait animal={animal}/>
      <div><strong>{animalName(animal)}</strong><small>
        {isMountAnimal(animal) ? "可驯为坐骑" : "野生动物"} · 喜欢{favorite}
      </small></div>
    </div>
    {full ? <button className="btn soft" onClick={onOpenRanch}>牧场已满 · 管理牧场</button> : <>
      {bait && <select aria-label="选择诱饵" value={bait.key} onChange={(event) => setChoice(event.target.value)}>
        {lots.map((lot) => <option value={lot.key} key={lot.key}>{lot.name} ×{lot.count}（需 {lot.needed}）</option>)}
      </select>}
      <button className="btn primary" disabled={!bait || bait.count < bait.needed}
        onClick={() => { if (bait) tame(animal.id, bait.key); }}>
        <PawIcon/>{!bait ? "先收获作物" : bait.count < bait.needed ? `还差 ${bait.needed - bait.count} 份诱饵` : `投喂 ${bait.needed} 份并收服`}
      </button>
    </>}
  </div>;
}

export function RanchHUD({ onOpenRanch }: { onOpenRanch: () => void }) {
  const nearby = useRanchInteraction((s) => s.nearbyAnimal);
  const nearRanch = useRanchInteraction((s) => s.nearRanch);
  const riding = useGame((s) => s.ranch.animals.find((animal) => animal.id === s.ranch.ridingId));
  const setRiding = useGame((s) => s.setRiding);
  return <>
    {riding && <button className="riding-action" onClick={() => setRiding(null)} title={animalName(riding)}>
      <PawIcon/>下坐骑
    </button>}
    {nearby ? <WildEncounter key={nearby.id} animal={nearby} onOpenRanch={onOpenRanch}/>
      : nearRanch && <button className="ranch-gate-action btn soft" onClick={onOpenRanch}><RanchIcon/>查看牧场</button>}
  </>;
}

export function RanchPanel({ onClose }: { onClose: () => void }) {
  const ranch = useGame((s) => s.ranch);
  const coins = useGame((s) => s.coins);
  const upgrade = useGame((s) => s.upgradeRanch);
  const setRiding = useGame((s) => s.setRiding);
  const release = useGame((s) => s.releaseAnimal);
  const [tab, setTab] = useState<"pasture" | "stable">("pasture");
  const [releasing, setReleasing] = useState<string | null>(null);
  const hasStable = ranch.level >= MOUNT_UNLOCK_LEVEL;
  const stable = hasStable ? ranch.animals.filter(isMountAnimal) : [];
  const residents = tab === "stable" ? stable : ranch.animals.filter((animal) => !hasStable || !isMountAnimal(animal));
  const capacity = ranchCapacity(ranch.level);
  const cost = ranchUpgradeCost(ranch.level);
  const go = (event: string) => { window.dispatchEvent(new Event(event)); onClose(); };

  return <div className="modal-scrim" onClick={onClose}>
    <section className="modal ranch-panel" role="dialog" aria-modal="true" aria-label="牧场管理" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <RanchIcon size={28}/><h2>牧场</h2>
        <span className="coin-pill"><CoinIcon/>{coins.toLocaleString("zh-CN")}</span>
        <button className="icon-btn ghost" onClick={onClose} aria-label="关闭牧场"><CloseIcon/></button>
      </div>
      <div className="ranch-overview">
        <div className="ranch-capacity"><strong>{ranch.level} 级牧场</strong><span>{ranch.animals.length} / {capacity} 只</span></div>
        <meter min="0" max={capacity} value={ranch.animals.length} aria-label="牧场已用容量"/>
        {cost === null ? <span className="muted small">已达到最高等级 {RANCH_MAX_LEVEL} 级</span> :
          <div className="ranch-upgrade"><span>下一级可容纳 <b>{ranchCapacity(ranch.level + 1)}</b> 只{ranch.level + 1 === MOUNT_UNLOCK_LEVEL && "，开启坐骑栏"}</span>
            <button className="btn mini" onClick={upgrade} disabled={coins < cost} aria-label={`升级牧场，花费 ${cost} 金币`}>
              <CoinIcon size={15}/>{cost.toLocaleString("zh-CN")} · 升级
            </button></div>}
      </div>
      <div className="ranch-directions">
        <button className="btn soft" onClick={() => go("ttfarm:visit-ranch")}><RanchIcon size={20}/>前往牧场</button>
        <button className="btn soft" onClick={() => go("ttfarm:find-wildlife")}><PawIcon/>寻找野生动物</button>
      </div>
      <div className="farm-tabs">
        <button aria-pressed={tab === "pasture"} onClick={() => { setTab("pasture"); setReleasing(null); }}>放牧区 · {ranch.animals.length - stable.length}</button>
        <button aria-pressed={tab === "stable"} onClick={() => { setTab("stable"); setReleasing(null); }}>{hasStable ? `坐骑栏 · ${stable.length}` : "坐骑栏 · 3级开启"}</button>
      </div>
      {residents.length === 0 ? <p className="ranch-empty">{tab === "pasture"
        ? "带上收获的作物，靠近野生动物后投喂。收服的动物会自动回到牧场。"
        : hasStable ? "收服一匹野马就能在这里骑乘。五行变异的狼、熊、虎、狮子、大象和熊猫也可作为坐骑。"
        : "牧场升至 3 级后，已收服的野马和适合骑乘的五行变异动物会自动进入坐骑栏。"}</p>
        : <ul className="ranch-list">{residents.map((animal) =>
          <li key={animal.id}>
            <AnimalPortrait animal={animal}/>
            <div className="resident-name"><strong>{animalName(animal)}</strong><small>
              {animal.element ? ANIMAL_ELEMENTS[animal.element].label + "系变异" : "普通动物"}
              {isMountAnimal(animal) && (ranch.ridingId === animal.id ? " · 骑乘中" : hasStable ? " · 可骑乘" : " · 3级可骑乘")}
              {animal.species === "horse" && ` · ${HORSE_SPEED_FACTOR} 倍移速`}
            </small></div>
            {releasing === animal.id ? <div className="resident-actions">
              <button className="btn mini" onClick={() => { release(animal.id); setReleasing(null); }}>确认放归</button>
              <button className="btn mini" onClick={() => setReleasing(null)}>取消</button>
            </div> : <div className="resident-actions">
              {tab === "stable" && <button className="btn mini" onClick={() => {
                if (ranch.ridingId === animal.id) setRiding(null);
                else if (setRiding(animal.id)) onClose();
              }}>{ranch.ridingId === animal.id ? "下坐骑" : "骑乘"}</button>}
              <button className="release-button" onClick={() => setReleasing(animal.id)} aria-label={`放归${animalName(animal)}`}>放归</button>
            </div>}
          </li>)}</ul>}
    </section>
  </div>;
}
