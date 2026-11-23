import { useEffect, useState } from "react";
import { SHOP_CROPS, levelFromXp } from "../game/crops";
import { FISHING_RODS, rodUnlocked } from "../game/fish";
import { BAITS, BOOST_CARDS } from "../game/items";
import { useGame } from "../game/state";
import { CloseIcon, CoinIcon, CropIcon, EquipmentIcon, HarvestIcon, ItemIcon, SeedIcon } from "./icons";
import { RodGlyph } from "./RodGlyph";
import "./backpack.css";
import "./shop.css";

type ShopTab = "seed" | "gear" | "item" | "material";

const TABS: { key: ShopTab; label: string; Icon: typeof SeedIcon }[] = [
  { key: "seed", label: "种子", Icon: SeedIcon },
  { key: "gear", label: "装备", Icon: EquipmentIcon },
  { key: "item", label: "道具", Icon: ItemIcon },
  { key: "material", label: "杂物", Icon: HarvestIcon },
];

function formatGrow(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} 秒`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} 分钟` : `${m} 分 ${s} 秒`;
}

function shopPageSize(): number {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const narrow = matchMedia("(max-width: 720px)").matches;
  return coarse || narrow ? 8 : 12;
}

function BaitGlyph({ color }: { color: string }) {
  return (
    <span className="bait-glyph" style={{ background: color }}>
      <i />
    </span>
  );
}

export function ShopPanel({ onClose }: { onClose: () => void }) {
  const coins = useGame((s) => s.coins);
  const seeds = useGame((s) => s.seeds);
  const items = useGame((s) => s.items);
  const materials = useGame((s) => s.materials);
  const ownedRods = useGame((s) => s.ownedRods);
  const fishingRod = useGame((s) => s.fishingRod);
  const xp = useGame((s) => s.xp);
  const buySeed = useGame((s) => s.buySeed);
  const buyBoostCard = useGame((s) => s.buyBoostCard);
  const buyBait = useGame((s) => s.buyBait);
  const buyFishingRod = useGame((s) => s.buyFishingRod);

  const level = levelFromXp(xp);
  const [tab, setTab] = useState<ShopTab>("seed");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(shopPageSize);

  useEffect(() => {
    const query = matchMedia("(pointer: coarse)");
    const sync = () => setPageSize(shopPageSize());
    query.addEventListener?.("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener?.("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const counts: Record<ShopTab, number> = {
    seed: SHOP_CROPS.length,
    gear: FISHING_RODS.length,
    item: BOOST_CARDS.length,
    material: BAITS.length,
  };
  const pageCount = Math.max(1, Math.ceil(counts[tab] / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [tab, pageSize]);

  return (
    <div className="modal-scrim bag-scrim" onClick={onClose}>
      <div className="modal bag-modal shop-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head bag-head">
          <h2>农场商店</h2>
          <div className="coin-pill">
            <CoinIcon />
            <b>{coins.toLocaleString("zh-CN")}</b>
          </div>
          <button className="icon-btn ghost bag-close" onClick={onClose} aria-label="关闭商店">
            <CloseIcon />
          </button>
        </div>

        <div className="bag-body">
          <div className="bag-tabs shop-tabs" role="tablist" aria-label="商店分类">
            {TABS.map(({ key, label, Icon }) => (
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
                <small>{counts[key]} 种</small>
              </button>
            ))}
          </div>

          <div className="bag-caption">
            <span>种子、装备、道具和鱼饵都在这里补给</span>
            <span>卖收成请去河岸售货大厅</span>
          </div>

          {tab === "seed" && (
            <div className="shop-grid">
              {SHOP_CROPS.slice(safePage * pageSize, safePage * pageSize + pageSize).map((crop) => {
                const locked = level < crop.unlockLevel;
                return (
                  <article key={crop.id} className={locked ? "shop-card locked" : "shop-card"}>
                    <div className="shop-card-head">
                      <span className="shop-card-icon"><CropIcon crop={crop.id} size={26} /></span>
                      <span className="shop-owned">已有 ×{seeds[crop.id] ?? 0}</span>
                    </div>
                    <strong>{crop.name}</strong>
                    <small>{formatGrow(crop.growMs)}成熟{locked ? ` · Lv${crop.unlockLevel} 解锁` : ""}</small>
                    <div className="shop-buy-row">
                      <span className="shop-price"><CoinIcon /> {crop.seedPrice}</span>
                      <button className="btn mini" disabled={locked || coins < crop.seedPrice} onClick={() => buySeed(crop.id, 1)}>
                        买 1
                      </button>
                      <button className="btn mini ghost" disabled={locked || coins < crop.seedPrice * 5} onClick={() => buySeed(crop.id, 5)}>
                        ×5
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {tab === "gear" && (
            <div className="shop-grid">
              {FISHING_RODS.map((rod) => {
                const owned = ownedRods.includes(rod.id);
                const equipped = fishingRod === rod.id;
                const locked = !rodUnlocked(rod, level);
                return (
                  <article key={rod.id} className={`shop-card rod-card${locked ? " locked" : ""}${equipped ? " equipped" : ""}`}>
                    <div className="shop-card-head">
                      <span className="shop-card-icon"><RodGlyph rod={rod} size={34} /></span>
                      <span className="shop-owned">{equipped ? "装备中" : owned ? "已拥有" : `Lv${rod.level}`}</span>
                    </div>
                    <strong>{rod.name}</strong>
                    <small>抛距 {rod.castRange.toFixed(1)}m · 亮区加成 +{Math.round(rod.zoneBonus * 100)}%</small>
                    {owned ? (
                      <div className="shop-owned-note">{equipped ? "正在使用这根鱼竿" : "打开背包「装备」页可装备"}</div>
                    ) : (
                      <div className="shop-buy-row">
                        <span className="shop-price"><CoinIcon /> {rod.price.toLocaleString("zh-CN")}</span>
                        <button className="btn mini" disabled={locked || coins < rod.price} onClick={() => buyFishingRod(rod.id)}>
                          {locked ? `Lv${rod.level} 解锁` : "购买"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {tab === "item" && (
            <div className="shop-grid">
              {BOOST_CARDS.slice(safePage * pageSize, safePage * pageSize + pageSize).map((card) => (
                <article key={card.id} className="shop-card boost-card">
                  <div className="shop-card-head">
                    <span className="shop-card-icon"><ItemIcon size={24} /></span>
                    <span className="shop-owned">已有 ×{items[card.id] ?? 0}</span>
                  </div>
                  <strong>{card.name}</strong>
                  <small>{card.blurb}</small>
                  <div className="shop-buy-row">
                    <span className="shop-price"><CoinIcon /> {card.price}</span>
                    <button className="btn mini" disabled={coins < card.price} onClick={() => buyBoostCard(card.id, 1)}>
                      买 1
                    </button>
                    <button className="btn mini ghost" disabled={coins < card.price * 5} onClick={() => buyBoostCard(card.id, 5)}>
                      ×5
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === "material" && (
            <div className="shop-grid">
              {BAITS.slice(safePage * pageSize, safePage * pageSize + pageSize).map((bait) => (
                <article key={bait.id} className="shop-card bait-card">
                  <div className="shop-card-head">
                    <span className="shop-card-icon"><BaitGlyph color={bait.color} /></span>
                    <span className="shop-owned">已有 ×{materials[bait.id] ?? 0}</span>
                  </div>
                  <strong>{bait.name}</strong>
                  <small>主诱：{bait.target}</small>
                  <div className="shop-buy-row">
                    <span className="shop-price"><CoinIcon /> {bait.price}</span>
                    <button className="btn mini" disabled={coins < bait.price} onClick={() => buyBait(bait.id, 1)}>
                      买 1
                    </button>
                    <button className="btn mini ghost" disabled={coins < bait.price * 5} onClick={() => buyBait(bait.id, 5)}>
                      ×5
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="bag-pager">
            <button type="button" disabled={safePage <= 0} onClick={() => setPage(Math.max(0, safePage - 1))}>‹</button>
            <span>{safePage + 1} / {pageCount}</span>
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}>›</button>
          </div>
        </div>

        <div className="bag-wallet">
          <span>鱼竿在背包「装备」页装备，鱼饵在钓鱼 HUD 里选择</span>
          <strong><CoinIcon /> {coins.toLocaleString("zh-CN")}</strong>
        </div>
      </div>
    </div>
  );
}
