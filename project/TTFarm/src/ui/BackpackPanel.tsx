import { useEffect, useMemo, useState } from "react";
import { CROP_LIST, harvestLots, type CropId } from "../game/crops";
import { FISHING_RODS, FISH_LIST, type FishingRod } from "../game/fish";
import { isReady } from "../game/growth";
import { BAITS, BOOST_CARDS } from "../game/items";
import type { Mutation } from "../game/weather";
import { useGame } from "../game/state";
import { useSocial } from "../game/social";
import {
  BAG_MAX_LEVEL,
  BAG_STACK_LIMIT,
  backpackSlots,
  backpackUpgradeCost,
  bagUsedSlots,
} from "../game/backpack";
import { BagIcon, CloseIcon, CoinIcon, CropIcon, EquipmentIcon, FishIcon, HarvestIcon, ItemIcon, SeedIcon } from "./icons";
import { RodGlyph } from "./RodGlyph";
import { BaitGlyph } from "./BaitGlyph";
import "./backpack.css";

type BagTab = "gear" | "item" | "seed" | "material" | "fish";

interface Stack {
  key: string;
  name: string;
  crop: CropId;
  mutation: Mutation | null;
  count: number;
  stackIndex: number;
  stackTotal: number;
  sort: number;
  fish?: boolean;
  kind?: "rod" | "boost" | "bait";
  rod?: FishingRod;
  id?: string;
  equipped?: boolean;
  selected?: boolean;
  color?: string;
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
  const fishCaught = useGame((s) => s.fishCaught);
  const items = useGame((s) => s.items);
  const materials = useGame((s) => s.materials);
  const ownedRods = useGame((s) => s.ownedRods);
  const fishingRod = useGame((s) => s.fishingRod);
  const selectedBait = useGame((s) => s.selectedBait);
  const selectedPlot = useGame((s) => s.selectedPlot);
  const plots = useGame((s) => s.plots);
  const level = useGame((s) => s.backpackLevel);
  const upgradeBackpack = useGame((s) => s.upgradeBackpack);
  const equipFishingRod = useGame((s) => s.equipFishingRod);
  const unequipFishingRod = useGame((s) => s.unequipFishingRod);
  const selectBait = useGame((s) => s.selectBait);
  const useBoostCard = useGame((s) => s.useBoostCard);
  const notify = useGame((s) => s.notify);
  const visit = useSocial((s) => s.visit);
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
  const gearUsed = ownedRods.length;
  const itemUsed = bagUsedSlots(items);
  const materialUsed = bagUsedSlots(harvest) + bagUsedSlots(materials);
  const fishUsed = bagUsedSlots(fishCaught);

  const entries = useMemo<Stack[]>(() => {
    if (tab === "gear") {
      return FISHING_RODS.filter((rod) => ownedRods.includes(rod.id)).flatMap((rod, index) =>
        splitStacks(
          {
            name: rod.name,
            crop: "radish",
            mutation: null,
            sort: index,
            kind: "rod",
            id: rod.id,
            rod,
            equipped: fishingRod === rod.id,
          },
          1,
        ),
      );
    }
    if (tab === "item") {
      return BOOST_CARDS.filter((card) => (items[card.id] ?? 0) > 0).flatMap((card, index) =>
        splitStacks(
          {
            name: card.name,
            crop: "radish",
            mutation: null,
            sort: index,
            kind: "boost",
            id: card.id,
          },
          items[card.id] ?? 0,
        ),
      );
    }
    if (tab === "seed") {
      return CROP_LIST.flatMap((crop, index) => {
        const count = seeds[crop.id] ?? 0;
        return splitStacks({ name: crop.name, crop: crop.id, mutation: null, sort: index }, count);
      });
    }
    if (tab === "fish") {
      return FISH_LIST.flatMap((fish, index) => {
        const count = fishCaught[fish.id] ?? 0;
        return splitStacks({ name: fish.name, crop: "radish", mutation: null, sort: index, fish: true }, count);
      });
    }
    const baitStacks = BAITS.filter((bait) => (materials[bait.id] ?? 0) > 0).flatMap((bait, index) =>
      splitStacks(
        {
          name: bait.name,
          crop: "radish",
          mutation: null,
          sort: index,
          kind: "bait",
          id: bait.id,
          selected: selectedBait === bait.id,
          color: bait.color,
        },
        materials[bait.id] ?? 0,
      ),
    );
    const crops = harvestLots(harvest).flatMap((lot, index) =>
      splitStacks(
        { name: lot.name, crop: lot.crop.id, mutation: lot.mutation ?? null, sort: BAITS.length + index },
        lot.count,
      ),
    );
    return [...baitStacks, ...crops];
  }, [tab, seeds, harvest, fishCaught, items, materials, ownedRods, fishingRod, selectedBait]);

  const pageCount = Math.max(1, Math.ceil(Math.max(slots, entries.length) / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const pageEntries = entries.slice(start, start + pageSize);
  const slotsOnPage = Math.min(pageSize, Math.max(0, Math.max(slots, entries.length) - start));
  const emptyCount = Math.max(0, slotsOnPage - pageEntries.length);
  const used = tab === "seed" ? seedUsed : tab === "gear" ? gearUsed : tab === "item" ? itemUsed : tab === "material" ? materialUsed : tab === "fish" ? fishUsed : 0;
  const over = used > slots;

  useEffect(() => {
    setPage(0);
  }, [tab, pageSize]);

  const tabs: { key: BagTab; label: string; used: number; Icon: typeof SeedIcon }[] = [
    { key: "gear", label: "装备", used: gearUsed, Icon: EquipmentIcon },
    { key: "item", label: "道具", used: itemUsed, Icon: ItemIcon },
    { key: "seed", label: "种子", used: seedUsed, Icon: SeedIcon },
    { key: "material", label: "杂物", used: materialUsed, Icon: HarvestIcon },
    { key: "fish", label: "鱼篓", used: fishUsed, Icon: FishIcon },
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

        {visit && <p className="bag-visit-note">串门中：这里只显示你自己的背包；协作采到的作物、野菜和鱼会进入{visit.ownerName}的仓库。</p>}

        {over && <p className="bag-over">当前分类已有 {used} 格，超出容量。先升级背包，或卖出/消耗一部分。</p>}

        {tab === "gear" && <p className="bag-hint">点击鱼竿装备，再点「装备中」的鱼竿即可卸下；装备后右下角大按钮才会变成钓鱼。</p>}
        {tab === "item" && <p className="bag-hint">点击加速卡：优先用在已选中的地块，没有选中就催熟最早种下的那一块。</p>}
        {tab === "material" && <p className="bag-hint">点击鱼饵即可选中；蔬菜收成和鱼饵共用「杂物」分类的格数。</p>}

        <div className={`bag-grid${pageSize === 10 ? " compact" : ""}`}>
          {pageEntries.map((item) => {
            const clickable = Boolean(item.kind);
            const action = () => {
              if (item.kind === "rod" && item.id) {
                if (fishingRod === item.id) unequipFishingRod();
                else equipFishingRod(item.id);
              } else if (item.kind === "bait" && item.id) {
                selectBait(selectedBait === item.id ? null : item.id);
              } else if (item.kind === "boost" && item.id) {
                const picked = selectedPlot !== null && plots[selectedPlot]?.crop && !isReady(plots[selectedPlot], Date.now())
                  ? selectedPlot
                  : plots.find((plot) => plot.crop && !isReady(plot, Date.now()))?.id;
                if (picked === undefined) {
                  notify("没有正在生长的地块，先种一茬再用加速卡", "warn");
                  return;
                }
                useBoostCard(item.id, picked);
              }
            };
            return (
              <div
                key={item.key}
                className={`bag-slot filled${clickable ? " clickable" : ""}${item.selected ? " selected" : ""}`}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? action : undefined}
                onKeyDown={clickable ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    action();
                  }
                } : undefined}
                title={`${item.name} ×${item.count}${item.stackTotal > 1 ? `（第 ${item.stackIndex + 1}/${item.stackTotal} 叠）` : ""}`}
              >
                {item.equipped && <i className="bag-slot-chip">装备中</i>}
                {item.selected && <i className="bag-slot-chip">已选</i>}
                <span className="bag-slot-icon">
                  {item.kind === "rod" && item.rod ? <RodGlyph rod={item.rod} size={31} />
                    : item.kind === "boost" ? <ItemIcon size={23} />
                      : item.kind === "bait" && item.color ? <BaitGlyph color={item.color} />
                        : item.fish ? <FishIcon size={25} />
                          : <CropIcon crop={item.crop} size={26} />}
                </span>
                <span className={`bag-slot-name${item.mutation ? ` variety-mark ${item.mutation}` : ""}`}>{item.name}</span>
                {!item.kind && <b className="bag-slot-count">×{item.count}</b>}
                {item.kind && item.kind !== "rod" && <b className="bag-slot-count">×{item.count}</b>}
                {item.stackTotal > 1 && <i className="bag-stack-index">{item.stackIndex + 1}/{item.stackTotal}</i>}
              </div>
            );
          })}
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
