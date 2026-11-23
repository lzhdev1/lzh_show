import { useMemo, useState, type CSSProperties } from "react";
import { CROPS, type CropId } from "../game/crops";
import {
  ANIMAL_PORTRAITS, CODEX_ANIMALS, CODEX_FISH, CODEX_MUTATIONS, CODEX_PLANTS, MOUNT_RULE, mountLabel, type CodexTab,
} from "../game/codex";
import { MUTATIONS } from "../game/weather";
import { codexAnimalKey, codexFishKey, codexMutationKey, codexPlantKey } from "../game/codexCollection";
import { useGame } from "../game/state";
import { CloseIcon, CropIcon } from "./icons";
import { FishPortrait } from "./FishPortrait";
import "./codex.css";

function BookIcon({ size = 20 }: { size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.4c2.6-1 5.4-1 8 .4 2.6-1.4 5.4-1.4 8-.4v13c-2.6-1-5.4-1-8 .4-2.6-1.4-5.4-1.4-8-.4Z" fill="#f6ecd8" stroke="#7d6a45" strokeWidth="1.4"/>
    <path d="M12 5.8v13" stroke="#7d6a45" strokeWidth="1.3"/>
    <path d="M6.4 9.2c1.3-.3 2.6-.2 3.8.3M6.4 12.4c1.3-.3 2.6-.2 3.8.3M6.4 15.6c1.3-.3 2.6-.2 3.8.3" stroke="#b39a68" strokeWidth="1.2"/>
    <path d="M13.8 9.6c1.2-.5 2.5-.6 3.8-.3M13.8 12.8c1.2-.5 2.5-.6 3.8-.3" stroke="#b39a68" strokeWidth="1.2"/>
  </svg>;
}

export function CodexTrigger({ onClick }: { onClick: () => void }) {
  return <button className="icon-btn labeled" onClick={onClick} aria-label="打开图鉴" title="图鉴">
    <BookIcon /><span>图鉴</span>
  </button>;
}

const TABS: { key: CodexTab; label: string }[] = [
  { key: "crop", label: "作物" },
  { key: "wild", label: "野菜" },
  { key: "herb", label: "草药" },
  { key: "mutation", label: "变异" },
  { key: "animal", label: "动物" },
  { key: "fish", label: "鱼类" },
];

type CodexFilter = "collected" | "uncollected" | "all";
const FILTERS: { key: CodexFilter; label: string }[] = [
  { key: "collected", label: "已收集" },
  { key: "uncollected", label: "未收集" },
  { key: "all", label: "全部" },
];
const TAB_LABEL = TABS.reduce((map, item) => ({ ...map, [item.key]: item.label }), {} as Record<CodexTab, string>);

const FAMILY_LABEL = { element: "元素变异", spirit: "精灵变异", legacy: "旧版变异", wild: "野菜变异", herb: "草药变异" } as const;

function seconds(ms: number) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ""}` : `${s}秒`;
}

export function CodexPanel({ onClose }: { onClose: () => void }) {
  const codexCollected = useGame((s) => s.codexCollected) ?? {};
  const [tab, setTab] = useState<CodexTab>("crop");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CodexFilter>("all");

  const q = query.trim();
  // 有关键词时跨全部四类一起搜，免得用户还得先猜该切哪个页签
  const searching = q.length > 0;
  const matchesFilter = (collected: boolean) =>
    filter === "all" || (filter === "collected" ? collected : !collected);
  const plants = useMemo(() => CODEX_PLANTS
    .filter((entry) => searching || (tab === "crop" || tab === "wild" || tab === "herb" ? entry.kind === tab : false))
    .filter((entry) => !q || entry.name.includes(q) || entry.blurb.includes(q))
    .filter((entry) => matchesFilter(Boolean(codexCollected[codexPlantKey(entry.crop)]))), [tab, q, searching, filter, codexCollected]);
  const mutations = useMemo(() => CODEX_MUTATIONS
    .filter((entry) => !q || entry.label.includes(q) || entry.blurb.includes(q)
      || FAMILY_LABEL[entry.family].includes(q))
    .filter((entry) => matchesFilter(Boolean(codexCollected[codexMutationKey(entry.id)]))), [q, filter, codexCollected]);
  const animals = useMemo(() => CODEX_ANIMALS
    .filter((entry) => !q || entry.name.includes(q) || entry.blurb.includes(q)
      || entry.favorite.name.includes(q) || mountLabel(entry).includes(q))
    .filter((entry) => matchesFilter(Boolean(codexCollected[codexAnimalKey(entry.species)]))), [q, filter, codexCollected]);
  const fishEntries = useMemo(() => CODEX_FISH
    .filter((entry) => !q || entry.fish.name.includes(q) || entry.fish.blurb.includes(q)
      || entry.fish.effect.includes(q) || entry.rarity.label.includes(q))
    .filter((entry) => matchesFilter(Boolean(codexCollected[codexFishKey(entry.fish.id)]))), [q, filter, codexCollected]);

  const progress = useMemo(() => {
    if (searching) {
      const total = CODEX_PLANTS.length + CODEX_MUTATIONS.length + CODEX_ANIMALS.length + CODEX_FISH.length;
      const collected = CODEX_PLANTS.filter((entry) => codexCollected[codexPlantKey(entry.crop)]).length
        + CODEX_MUTATIONS.filter((entry) => codexCollected[codexMutationKey(entry.id)]).length
        + CODEX_ANIMALS.filter((entry) => codexCollected[codexAnimalKey(entry.species)]).length
        + CODEX_FISH.filter((entry) => codexCollected[codexFishKey(entry.fish.id)]).length;
      return { label: "全部图鉴", total, collected };
    }
    if (tab === "mutation") {
      const total = CODEX_MUTATIONS.length;
      const collected = CODEX_MUTATIONS.filter((entry) => codexCollected[codexMutationKey(entry.id)]).length;
      return { label: TAB_LABEL[tab], total, collected };
    }
    if (tab === "animal") {
      const total = CODEX_ANIMALS.length;
      const collected = CODEX_ANIMALS.filter((entry) => codexCollected[codexAnimalKey(entry.species)]).length;
      return { label: TAB_LABEL[tab], total, collected };
    }
    if (tab === "fish") {
      const total = CODEX_FISH.length;
      const collected = CODEX_FISH.filter((entry) => codexCollected[codexFishKey(entry.fish.id)]).length;
      return { label: TAB_LABEL[tab], total, collected };
    }
    const entries = CODEX_PLANTS.filter((entry) => entry.kind === tab);
    return {
      label: TAB_LABEL[tab],
      total: entries.length,
      collected: entries.filter((entry) => codexCollected[codexPlantKey(entry.crop)]).length,
    };
  }, [tab, searching, codexCollected]);
  const percent = progress.total > 0 ? Math.round(progress.collected / progress.total * 100) : 0;
  const collectedCount = plants.length + mutations.length + animals.length + fishEntries.length;
  const plantCollected = (id: CropId) => Boolean(codexCollected[codexPlantKey(id)]);

  return <div className="modal-scrim codex-scrim" onClick={onClose}>
    <section className="modal codex-panel" role="dialog" aria-modal="true" aria-label="图鉴" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <BookIcon size={28}/><h2>图鉴</h2>
        <span className="codex-count">{searching
          ? `匹配 ${collectedCount} 条`
          : `共 ${CODEX_PLANTS.length + CODEX_MUTATIONS.length + CODEX_ANIMALS.length + CODEX_FISH.length} 条`}</span>
        <button className="icon-btn ghost" onClick={onClose} aria-label="关闭图鉴"><CloseIcon/></button>
      </div>

      <div className="farm-tabs">
        {TABS.map((item) => <button key={item.key} aria-pressed={tab === item.key}
          onClick={() => setTab(item.key)}>{item.label}</button>)}
      </div>

      <div className="codex-progress" aria-label={`${progress.label}收集完成度`}>
        <div className="codex-progress-copy">
          <span>{progress.label}收集完成度</span>
          <b>{progress.collected}/{progress.total}</b>
          <small>{percent}%</small>
        </div>
        <div className="codex-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={percent} aria-valuetext={`${progress.collected}/${progress.total}`}>
          <i style={{ width: `${percent}%` }}/>
        </div>
      </div>

      <div className="codex-tools">
        <input className="codex-search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="搜名字或关键词，比如「坐骑」「阴阳」" aria-label="搜索图鉴"/>
        <div className="codex-filters" role="group" aria-label="收集筛选">
          {FILTERS.map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key}
            className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>)}
        </div>
      </div>

      {(tab === "crop" || tab === "wild" || tab === "herb" || searching) && <>
        {searching && <h3 className="codex-group">作物、野菜与草药 · {plants.length}</h3>}
        <ul className="codex-list">
        {plants.map((entry) => {
          const def = CROPS[entry.crop];
          const collected = plantCollected(entry.crop);
          return <li key={entry.crop} className="codex-card">
            <div className="codex-head">
              <span className="codex-icon"><CropIcon crop={entry.crop} size={22}/></span>
              <div className="codex-title">
                <strong>{def.name}</strong>
                <small>Lv{def.unlockLevel} · 售价 {def.sellPrice} × {def.yields} 份 · 生长 {seconds(def.growMs)}{def.herb ? " · 种子仅野外草药丛掉落" : def.wild ? " · 种子仅野外掉落" : ` · 种子 ${def.seedPrice} 金`}</small>
              </div>
              {collected ? <span className="codex-owned">已收集</span> : <span className="codex-owned muted">未收集</span>}
            </div>
            <p className="codex-text">{entry.blurb}</p>
            {entry.lures.length > 0
              ? <div className="codex-tags"><span className="codex-taglabel">会引来</span>
                {entry.lures.map((lure) => <span className="codex-chip" key={lure.species}>
                  {ANIMAL_PORTRAITS[lure.species]} {lure.name}</span>)}
              </div>
              : <div className="codex-tags"><span className="codex-taglabel">会引来</span>
                <span className="codex-none">{entry.kind === "herb" ? "草药气味不入兽口" : "暂无（野生动物对它没兴趣）"}</span></div>}
          </li>;
        })}
        {plants.length === 0 && <li className="codex-empty">没有符合条件的条目</li>}
      </ul></>}

      {(tab === "mutation" || searching) && <>
        {searching && <h3 className="codex-group">变异 · {mutations.length}</h3>}
        <ul className="codex-list">
        {mutations.map((entry) => {
          const collected = Boolean(codexCollected[codexMutationKey(entry.id)]);
          return <li key={entry.id} className="codex-card">
            <div className="codex-head">
              <span className="codex-icon mutation" style={{ "--mutation-tint": `#${MUTATIONS[entry.id].fruit.toString(16).padStart(6, "0")}` } as CSSProperties}>
                ×{entry.multiplier}
              </span>
              <div className="codex-title">
                <strong>{entry.label}</strong>
                <small>{FAMILY_LABEL[entry.family]} · 收成售价倍率 ×{entry.multiplier}</small>
              </div>
              {collected ? <span className="codex-owned">已收集</span> : <span className="codex-owned muted">未收集</span>}
            </div>
            <p className="codex-text">{entry.blurb}</p>
          </li>;
        })}
        {mutations.length === 0 && <li className="codex-empty">没有符合条件的条目</li>}
      </ul></>}

      {(tab === "animal" || searching) && <>
        {searching && <h3 className="codex-group">动物 · {animals.length}</h3>}
        <ul className="codex-list">
          {animals.map((entry) => {
            const collected = Boolean(codexCollected[codexAnimalKey(entry.species)]);
            return <li key={entry.species} className="codex-card">
              <div className="codex-head">
                <span className="codex-icon animal">{ANIMAL_PORTRAITS[entry.species]}</span>
                <div className="codex-title">
                  <strong>{entry.name}</strong>
                  <small>{entry.mount === "never" ? "野生伙伴 · 不可骑乘" : "野生伙伴 · 可作坐骑"}</small>
                </div>
                {collected ? <span className="codex-owned">已收集</span> : <span className="codex-owned muted">未收集</span>}
              </div>
              <p className="codex-text">{entry.blurb}</p>
              <div className="codex-tags">
                <span className="codex-taglabel">被引诱</span>
                <span className="codex-chip"><CropIcon crop={entry.favorite.crop} size={13}/> {entry.favorite.name} · 1 份</span>
                <span className="codex-taglabel">坐骑</span>
                <span className={`codex-chip${entry.mount === "never" ? "" : " good"}`}>{mountLabel(entry)}</span>
              </div>
            </li>;
          })}
          {animals.length === 0 && <li className="codex-empty">没有符合条件的条目</li>}
        </ul>
        <p className="codex-note">{MOUNT_RULE}元素变异动物对非最爱的作物要 2 份诱饵，最爱的作物 1 份就够。</p>
      </>}

      {(tab === "fish" || searching) && <>
        {searching && <h3 className="codex-group">鱼类 · {fishEntries.length}</h3>}
        <ul className="codex-list fish-codex-list">
          {fishEntries.map(({ fish, rarity }) => {
            const collected = Boolean(codexCollected[codexFishKey(fish.id)]);
            return <li key={fish.id} className="codex-card fish-codex-card">
              <div className={`fish-codex-art${collected ? "" : " dim"}`} style={{ "--rarity": rarity.color } as CSSProperties}>
                <FishPortrait fish={fish} size={138} dim={!collected} />
              </div>
              <div className="fish-codex-copy">
                <div className="codex-head">
                  <div className="codex-title">
                    <strong>{fish.name}</strong>
                    <small><span className={`fish-rarity-dot rarity-${fish.rarity}`} style={{ "--rarity": rarity.color } as CSSProperties}>{rarity.label}</span> · 售价 {fish.price} 金 · 体长 {fish.visual.length.toFixed(2)} m</small>
                  </div>
                  {collected ? <span className="codex-owned">已收集</span> : <span className="codex-owned muted">未收集</span>}
                </div>
                <p className="codex-text">{fish.blurb}</p>
                <div className="fish-codex-effect"><span>功能</span><b>{fish.effect}</b></div>
              </div>
            </li>;
          })}
          {fishEntries.length === 0 && <li className="codex-empty">没有符合条件的条目</li>}
        </ul>
        <p className="codex-note">河湾里共 50 种鱼。越贵的鱼，遛鱼时的金色亮区越窄、小球越快；鱼竿越好，亮区越宽。</p>
      </>}
    </section>
  </div>;
}
