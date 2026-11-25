import { useRef } from "react";
import { useClock } from "../game/clock";
import { CROPS, harvestYieldOf, produceName, producePrice, seedInfoOf } from "../game/crops";
import { useFieldInteraction } from "../game/fieldInteraction";
import { formatRemain, isReady, plotMutationRevealed, remainingMs, selfWaterGate, waterHint } from "../game/growth";
import { useGame } from "../game/state";
import { HarvestIcon, SowIcon, WateringCanIcon } from "./icons";

const actions = {
  sow: { label: "撒种", Icon: SowIcon },
  water: { label: "浇水", Icon: WateringCanIcon },
  harvest: { label: "收获", Icon: HarvestIcon },
};

export function PlotAction() {
  const standingPlot = useFieldInteraction((s) => s.standingPlot);
  const plot = useGame((s) => standingPlot === null ? undefined : s.plots[standingPlot]);
  const selectedSeed = useGame((s) => s.selectedSeed);
  const seedCount = useGame((s) => s.seeds[s.selectedSeed]);
  const seedInfo = seedInfoOf(selectedSeed);
  const revealMutation = useClock(({ now }) => (plot ? plotMutationRevealed(plot, now) : false));
  const secondsLeft = useClock(({ now }) => {
    const ms = plot && remainingMs(plot, now);
    return ms == null ? null : Math.ceil(ms / 1000);
  });
  const ready = secondsLeft === 0;
  // 1.每株累计最多浇 25 次；2.播种后 3 次免费；3.之后每小时 2 次
  const canWater = useClock(({ now }) => (plot?.crop && !isReady(plot, now) ? selfWaterGate(plot, now).ok : false));
  const waterNote = useClock(({ now }) => (plot?.crop ? waterHint(plot, now) : ""));
  const pressedTarget = useRef<string | null>(null);
  if (!plot?.unlocked) return null;

  let action: keyof typeof actions;
  let detail: string;
  let description: string;
  if (!plot.crop) {
    action = "sow";
    const seedName = seedInfo
      ? (seedInfo.mutation ? `${produceName(seedInfo.def, seedInfo.mutation)}种子` : `${seedInfo.def.name}种子`)
      : "种子";
    detail = seedCount > 0 ? `${seedName} ×${seedCount}` : `${seedName}已用完`;
    description = seedCount > 0 ? detail : `${detail}，请先到商店购买种子`;
  } else {
    action = ready ? "harvest" : "water";
    const crop = CROPS[plot.crop];
    const mutation = revealMutation ? plot.mutation : null;
    const cropName = produceName(crop, mutation);
    if (ready) {
      const count = harvestYieldOf(crop, plot.id, plot.plantedAt);
      detail = `${cropName} ×${count}`;
      description = `${detail}，售价 ${producePrice(crop, mutation)} 金币/份`;
    } else {
      const remaining = secondsLeft === null ? "生长中" : formatRemain(secondsLeft * 1000).replace(/\s/g, "");
      detail = `${cropName} · ${remaining}`;
      description = `${cropName}，已浇水 ${plot.watered} 次（−${Math.min(100, plot.watered * 2)}%），${remaining}${waterNote ? `，${waterNote}` : ""}`;
    }
  }

  const { Icon } = actions[action];
  const blocked = action === "water" && !canWater;
  const label = blocked ? (waterNote.includes("上限") ? "已浇足" : "浇水冷却") : actions[action].label;
  const accessibleLabel = `第 ${plot.id + 1} 号地，${label}，${description}`;
  const target = `${plot.id}/${action}/${plot.crop ?? selectedSeed}/${plot.plantedAt}`;

  return (
    <button type="button" className="plot-action" data-action={action} disabled={blocked}
      title={accessibleLabel} aria-label={accessibleLabel}
      onPointerDown={() => { pressedTarget.current = target; }}
      onPointerCancel={() => { pressedTarget.current = null; }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        // Holding the button while walking or ripening must not activate the new action.
        const samePress = event.detail === 0 || pressedTarget.current === target;
        pressedTarget.current = null;
        if (!samePress || useFieldInteraction.getState().standingPlot !== plot.id) return;
        const game = useGame.getState();
        if (game.plots[plot.id] !== plot || ready !== isReady(plot, Date.now())) return;
        if (!plot.crop && game.selectedSeed !== selectedSeed) return;
        switch (action) {
          case "sow":
            if (seedCount <= 0) {
              game.notify("请先到商店购买种子", "warn");
              break;
            }
            game.plant(plot.id);
            break;
          case "water": game.water(plot.id); break;
          case "harvest": game.harvestPlot(plot.id); break;
        }
      }}>
      <span className="plot-action-icon"><Icon size={29} /></span>
      <span className="plot-action-copy"><strong>{label}</strong><small>{detail}</small></span>
    </button>
  );
}
