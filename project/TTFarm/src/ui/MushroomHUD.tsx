import type { CSSProperties } from "react";
import { MUSHROOM_HABITAT_LABEL, MUSHROOM_MUTATION_LABEL, MUSHROOM_RARITY_LABEL } from "../game/mushrooms";
import { markMushroomTaken, useMushroomInteraction } from "../game/mushroomInteraction";
import { useGame } from "../game/state";
import { MushroomIcon } from "./icons";
import "./mushroom-hud.css";

/** 脚边菌子的采集卡：名称、宿主、变异与价格都从蘑菇数据直接读。 */
export function MushroomHUD() {
  const nearby = useMushroomInteraction((s) => s.nearby);
  const collectMushroom = useGame((s) => s.collectMushroom);
  if (!nearby) return null;
  const { species, mutation, hostLabel } = nearby;
  const mutationClass = mutation ? ` mutation-${mutation}` : "";
  return <div className={`wild-encounter forage-encounter mushroom-encounter${mutationClass}`} role="group" aria-label="采集蘑菇">
    <div className="wild-encounter-head">
      <span className="animal-portrait forage-portrait mushroom-portrait" aria-hidden="true"
        style={{ "--mushroom-tint": species.cap } as CSSProperties}>
        <MushroomIcon cap={species.cap} stem={species.stem} accent={species.accent} size={23}/>
      </span>
      <div>
        <strong>{species.name}</strong>
        <small>{MUSHROOM_RARITY_LABEL[species.rarity]}菌 · 生于{hostLabel || MUSHROOM_HABITAT_LABEL[species.habitat]} · {species.price} 金币</small>
      </div>
    </div>
    {mutation && <p className={`mushroom-mutation-line ${mutation}`}>{MUSHROOM_MUTATION_LABEL[mutation]}变异 · {
      mutation === "magic" ? "暗紫雾气里有小骷髅影子" : mutation === "mist" ? "七彩雾上架着小彩虹" : "会吐槽，也会偷偷换位"
    }</p>}
    <button className="btn primary" onClick={() => {
      if (collectMushroom(species.id)) markMushroomTaken(nearby.id);
    }}>
      采摘并记入图鉴
    </button>
    <p className="mushroom-season-tip">菌季只持续雨后这一个天气阶段，下一场雨再来。</p>
  </div>;
}
