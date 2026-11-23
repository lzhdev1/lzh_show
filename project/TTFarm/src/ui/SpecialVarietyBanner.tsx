import { useEffect, useState } from "react";
import { useSpecialNotice } from "../game/specialNotice";
import "./special-notice.css";

/** 顶部金黄流光条：非普通五行变异的作物一出现就播报一次。 */
export function SpecialVarietyBanner() {
  const id = useSpecialNotice((s) => s.id);
  const text = useSpecialNotice((s) => s.text);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!id || !text) return;
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), 4600);
    return () => window.clearTimeout(timer);
  }, [id, text]);

  if (!shown || !text) return null;
  return <div className="special-variety-banner" role="status" key={id}>
    <span className="special-variety-shine" aria-hidden="true"/>
    <span className="special-variety-star" aria-hidden="true">✦</span>
    <b>{text}</b>
    <span className="special-variety-star" aria-hidden="true">✦</span>
  </div>;
}
