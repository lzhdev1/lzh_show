import type { ReactNode } from "react";
import { useTownInteraction } from "../game/townInteraction";
import { useTownNav } from "../game/townNav";
import { DEALERSHIP } from "../scene/town/townLayout";
import "./town.css";

/** 进入售货大厅 / 汽车店 / 便利店时出现的临场操作，以及城内汽车店导览 */
export function TownHUD({ onOpenMarket, onOpenCarStore }: {
  onOpenMarket: () => void;
  onOpenCarStore: () => void;
}) {
  const place = useTownInteraction((s) => s.place);
  const martName = useTownInteraction((s) => s.martName);
  const inTown = useTownNav((s) => s.inTown);
  const x = useTownNav((s) => s.x);
  const z = useTownNav((s) => s.z);
  const request = useTownNav((s) => s.request);

  const doorX = DEALERSHIP.x + DEALERSHIP.w / 2 + 1.55;
  const dx = doorX - x;
  const dz = DEALERSHIP.eastDoorZ - z;
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = Math.abs(dx) > Math.abs(dz)
    ? (dx >= 0 ? "东" : "西")
    : (dz >= 0 ? "北" : "南");

  let action: ReactNode = null;
  if (place === "market") {
    action = <button className="town-action btn soft" onClick={onOpenMarket}>
      河岸售货大厅 · 卖菜 / 卖肉
    </button>;
  } else if (place === "dealer") {
    action = <button className="town-action btn soft" onClick={onOpenCarStore}>
      星野汽车 · 看车 / 购车
    </button>;
  } else if (place === "mart-a" || place === "mart-b") {
    action = <div className="town-action town-badge">{martName || "24H 便利店"} · 营业中</div>;
  }

  return <>
    {action}
    {!place && inTown && (
      <aside className="town-guide" aria-label="城市导览">
        <span className="town-guide-kicker">河东小城 · 汽车店</span>
        <strong>星野汽车 <em>{distance}m · {direction}边</em></strong>
        <button type="button" className="town-guide-go" onClick={() => request("dealer")}>
          带我去
        </button>
      </aside>
    )}
  </>;
}
