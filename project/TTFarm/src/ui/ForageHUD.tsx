import { CROPS, produceName, producePrice } from "../game/crops";
import { FORAGE_SEED_CHANCE, HERB_SEED_CHANCE } from "../game/forage";
import { useForageInteraction } from "../game/forageInteraction";
import { useGame } from "../game/state";
import { MUTATIONS } from "../game/weather";
import { CropIcon, HarvestIcon } from "./icons";

/** 脚边出现野菜丛时的采摘卡片，样式与野生动物投喂卡同族 */
export function ForageHUD() {
  const patch = useForageInteraction((s) => s.nearbyPatch);
  const foragePatch = useGame((s) => s.foragePatch);
  if (!patch) return null;
  const def = CROPS[patch.crop];
  const name = produceName(def, patch.mutation);
  const price = producePrice(def, patch.mutation);
  const herb = Boolean(def.herb);
  const seedChance = herb ? HERB_SEED_CHANCE : FORAGE_SEED_CHANCE;
  return <div className="wild-encounter forage-encounter" role="group" aria-label={herb ? "采摘草药" : "采摘野菜"}>
    <div className="wild-encounter-head">
      <span className="animal-portrait forage-portrait" aria-hidden="true"><CropIcon crop={patch.crop} size={22}/></span>
      <div><strong className={patch.mutation ? `variety-mark ${patch.mutation}` : ""}>{name}</strong><small>
        {herb ? "野生草药" : "野生野菜"} · {price} 金币/份{patch.mutation ? ` · ${MUTATIONS[patch.mutation].label}` : ""}
      </small></div>
    </div>
    <button className="btn primary" onClick={() => foragePatch(patch.id)}>
      <HarvestIcon/>采摘（{Math.round(seedChance * 100)}% 捡到种子）
    </button>
  </div>;
}