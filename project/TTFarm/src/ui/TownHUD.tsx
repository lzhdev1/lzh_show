import { useTownInteraction } from "../game/townInteraction";
import "./town.css";

/** 进入售货大厅 / 汽车店 / 便利店时出现的临场操作 */
export function TownHUD({ onOpenMarket, onOpenCarStore }: {
  onOpenMarket: () => void;
  onOpenCarStore: () => void;
}) {
  const place = useTownInteraction((s) => s.place);
  const martName = useTownInteraction((s) => s.martName);

  if (place === "market") {
    return (
      <button className="town-action btn soft" onClick={onOpenMarket}>
        河岸售货大厅 · 卖菜 / 卖肉
      </button>
    );
  }
  if (place === "dealer") {
    return (
      <button className="town-action btn soft" onClick={onOpenCarStore}>
        星野汽车 · 看车 / 购车
      </button>
    );
  }
  if (place === "mart-a" || place === "mart-b") {
    return <div className="town-action town-badge">{martName || "24H 便利店"} · 营业中</div>;
  }
  return null;
}
