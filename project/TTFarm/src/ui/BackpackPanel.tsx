import { useEffect, useMemo, useState } from "react";
import { CROPS, CROP_LIST, harvestLots, type CropId } from "../game/crops";
import type { Mutation } from "../game/weather";
import { useGame } from "../game/state";
import {
  BAG_MAX_LEVEL,
  BAG_STACK_LIMIT,
  backpackSlots,
  backpackUpgradeCost,
  bagUsedSlots,
} from "../game/backpack";
import { BagIcon, CloseIcon, CoinIcon, CropIcon, EquipmentIcon, HarvestIcon, ItemIcon, SeedIcon } from "./icons";
import "./backpack.css";

type BagTab = "gear" | "item" | "seed" | "material";
const EMPTY: Record<string, number> = {};

interface Stack {
  key: string;
  name: string;
  crop: CropId;
  mutation: Mutation | null;
  count: number;
  stackIndex: number;
  stackTotal: number;
  sort: number;
}

function splitStacks(base: Omit<Stack, "key" | "count" | "stackIndex" | "stackTotal">, count: number): Stack[] {
  const total = Math.max(0, Math.trunc(count));
  if (total <= 0) return [];
  const stackTotal = Math.ceil(total / BAG_STACK_LIMIT);
  return Array.from({ length: stackTotal }, (_, stackIndex) => ({
    ...base,
    key: `${base.name}:${base.crop}:${stackIndex}`,
    count: Math.min(BAG_STACK_LIMIT, total - stackIndex * BAG_STACK_LIMIT),
    stackIndex,
    stackTotal,
  }));
}

function pageSizeForWidth(): number {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const narrow = matchMedia("(max-width: 720px)").matches;
  return coarse || narrow ? 10 : 30;
}

export function BackpackPanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const seeds = useGame((s) => s.seeds);
  const harvest = useGame((s) => s.harvest);
  const level = useGame((s) => s.backpackLevel);
  const upgradeBackpack = useGame((s) => s.upgradeBackpack);
  const [tab, setTab] = useState<BagTab>("seed");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeForWidth);

  useEffect(() => {
    const query = matchMedia("(pointer: coarse)");
    const sync = () => setPageSize(pageSizeForWidth());
    query.addEventListener?.("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener?.("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const slots = backpackSlots(level);
  const upgradeCost = backpackUpgradeCost(level);
  const seedUsed = bagUsedSlots(seeds);
  const materialUsed = bagUsedSlots(harvest);

  const entries = useMemo<Stack[]>(() => {
    if (tab === "gear") return splitEmpty(EMPTY);
    if (tab === "item") return splitEmpty(EMPTY);
    if (tab === "seed") {
      return CROP_LIST.flatMap((crop, index) => {
        const count = seeds[crop.id] ?? 0;
        return splitStacks({ name: crop.name, crop: crop.id, mutation: null, sort: index }, count);
      });
    }
    return harvestLots(harvest).flatMap((lot, index) =>
      splitStacks(
        { name: lot.name, crop: lot.crop.id, mutation: lot.mutation ?? null, sort: index },
        lot.count,
      ),
    );
  }, [tab, seeds, harvest]);

  const pageCount = Math.max(1, Math.ceil(Math.max(slots, entries.length) / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const pageEntries = entries.slice(start, start + pageSize);
  const slotsOnPage = Math.min(pageSize, Math.max(0, Math.max(slots, entries.length) - start));
  const emptyCount = Math.max(0, slotsOnPage - pageEntries.length);
  const over = (tab === "seed" ? seedUsed : tab === "material" ? materialUsed : 0) > slots;

  useEffect(() => {
    setPage(0);
  }, [tab, pageSize]);

  const used = tab === "seed" ? seedUsed : tab === "material" ? materialUsed : 0;
  const tabs: { key: BagTab; label: string; used: number; Icon: typeof SeedIcon }[] = [
    { key: "gear", label: "装备", used: 0, Icon: EquipmentIcon },
    { key: "item", label: "道具", used: 0, Icon: ItemIcon },
    { key: "seed", label: "种子", used: seedUsed, Icon: SeedIcon },
    { key: "material", label: "杂物", used: materialUsed, Icon: HarvestIcon },
  ];

  return (
    <div className="modal-scrim bag-scrim" onClick={onClose}>
      <div className="modal bag-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head bag-head">
          <h2>背包</h2>
          <span className="bag-level">Lv{level}</span>
          <button className="icon-btn ghost bag-close" onClick={onClose} aria-label="关闭背包">
            <CloseIcon />
          </button>
        </div>

        <div className="bag-body">
          <div className="bag-tabs" role="tablist" aria-label="背包分类">
          {tabs.map(({ key, label, used: tabUsed, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
              <small>{tabUsed}/{slots}</small>
            </button>
          ))}
        </div>

        <div className="bag-caption">
          <span>每格 1 件，同类最多叠加 {BAG_STACK_LIMIT}</span>
          <span>每类 {slots} 格 · 分页 {pageSize} 格</span>
        </div>

        {over && <p className="bag-over">当前分类已有 {used} 格，超出容量。先升级背包，或卖出/消耗一部分。</p>}

        {tab !== "seed" && tab !== "material" && (
          <p className="bag-empty-note">{tab === "gear" ? "装备分类还没开放，后续装备会在这里展示" : "道具分类还没开放，后续道具会在这里展示"}</p>
        )}

        <div className={`bag-grid${pageSize === 10 ? " compact" : ""}`}>
          {pageEntries.map((item) => (
            <div
              key={item.key}
              className="bag-slot filled"
              title={`${item.name} ×${item.count}${item.stackTotal > 1 ? `（第 ${item.stackIndex + 1}/${item.stackTotal} 叠）` : ""}`}
            >
              <span className="bag-slot-icon"><CropIcon crop={item.crop} size={26} /></span>
              <span className={`bag-slot-name${item.mutation ? ` variety-mark ${item.mutation}` : ""}`}>{item.name}</span>
              <b className="bag-slot-count">×{item.count}</b>
              {item.stackTotal > 1 && <i className="bag-stack-index">{item.stackIndex + 1}/{item.stackTotal}</i>}
            </div>
          ))}
          {Array.from({ length: emptyCount }, (_, index) => (
            <div key={`empty-${start}-${index}`} className="bag-slot empty" aria-hidden="true" />
          ))}
        </div>

        <div className="bag-pager">
          <button type="button" disabled={safePage <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>‹</button>
          <span>{safePage + 1} / {pageCount}</span>
          <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>›</button>
        </div>
        </div>

        <div className="bag-upgrade">
          <div>
            <strong>{upgradeCost === null ? `背包已满级 Lv${BAG_MAX_LEVEL}` : `升级背包至 Lv${level + 1}`}</strong>
            <small>
              {upgradeCost === null
                ? `每类 ${slots} 格`
                : `每类 ${backpackSlots(level + 1)} 格（+10）· 需要 ${upgradeCost} 金币`}
            </small>
          </div>
          <button
            type="button"
            className="btn primary bag-upgrade-btn"
            disabled={upgradeCost === null || coins < upgradeCost}
            onClick={upgradeBackpack}
          >
            {upgradeCost === null ? "已满级" : coins < upgradeCost ? `还差 ${upgradeCost - coins}` : `升级 · ${upgradeCost}`}
          </button>
        </div>

        <div className="bag-wallet">
          <span><BagIcon size={18} />资金</span>
          <strong><CoinIcon /> {coins.toLocaleString("zh-CN")}</strong>
        </div>
      </div>
    </div>
  );
}

function splitEmpty(items: Record<string, number>): Stack[] {
  return Object.entries(items).flatMap(([key, count], index) =>
    splitStacks({ name: CROPS[key as CropId]?.name ?? key, crop: key as CropId, mutation: null, sort: index }, count),
  );
}
