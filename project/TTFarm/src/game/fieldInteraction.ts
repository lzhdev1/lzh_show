import { create } from "zustand";

/** 脚下的可耕种地块只在当前场景有效，移动不触发存档。 */
export const useFieldInteraction = create<{ standingPlot: number | null }>()(() => ({
  standingPlot: null,
}));

export function setStandingPlot(id: number | null): void {
  if (useFieldInteraction.getState().standingPlot !== id) {
    useFieldInteraction.setState({ standingPlot: id });
  }
}
