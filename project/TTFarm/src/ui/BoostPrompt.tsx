import { useClock } from "../game/clock";
import { CROPS, produceName } from "../game/crops";
import { useFieldInteraction } from "../game/fieldInteraction";
import { isReady, plotMutationRevealed } from "../game/growth";
import { boostCardById } from "../game/items";
import { useGame } from "../game/state";
import { ItemIcon } from "./icons";

/**
 * 底部道具栏选中加速卡后，站到正在生长的地块上才会出现。
 * 只对这一块地生效，避免误用到别的菜地。
 */
export function BoostPrompt() {
  const standingPlot = useFieldInteraction((s) => s.standingPlot);
  const plot = useGame((s) => standingPlot === null ? undefined : s.plots[standingPlot]);
  const selectedBoost = useGame((s) => s.selectedBoost);
  const count = useGame((s) => selectedBoost ? s.items[selectedBoost] ?? 0 : 0);
  const useBoostCard = useGame((s) => s.useBoostCard);
  const selectBoost = useGame((s) => s.selectBoost);
  const now = useClock((s) => s.now);

  const card = boostCardById(selectedBoost);
  if (!plot?.crop || !card || count <= 0 || isReady(plot, now)) return null;

  const crop = CROPS[plot.crop];
  const cropName = produceName(crop, plotMutationRevealed(plot, now) ? plot.mutation : null);
  return <div className="boost-prompt" role="dialog" aria-label="是否使用加速卡">
    <span className="boost-prompt-icon"><ItemIcon size={20} /></span>
    <span className="boost-prompt-copy">
      <strong>使用「{card.name}」？</strong>
      <small>对这块地的{cropName}生效，剩余 {count} 张</small>
    </span>
    <button type="button" className="boost-prompt-use"
      onClick={() => useBoostCard(card.id, plot.id)}>使用</button>
    <button type="button" className="boost-prompt-cancel"
      onClick={() => selectBoost(null)}>取消</button>
  </div>;
}
