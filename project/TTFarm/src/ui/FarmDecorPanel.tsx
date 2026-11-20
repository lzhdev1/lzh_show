import { useState } from "react";
import { DECOR_STYLES, normalizeDecor, type DecorStyle, type FarmDecor } from "../game/decor";
import { useGame } from "../game/state";

const parts = [
  ["fence", "围栏"], ["gate", "农场门"], ["sign", "牌匾"], ["lettering", "牌匾字体"],
] as const;

export function FarmDecorPanel({ onClose }: { onClose: () => void }) {
  const saved = useGame(s => s.decor);
  const [draft, setDraft] = useState<FarmDecor>(saved);
  const set = (part: keyof FarmDecor, value: string) => setDraft(prev => ({ ...prev, [part]: value }));
  const match = DECOR_STYLES.find(s => parts.every(([key]) => draft[key] === s.id));
  function chooseStyle(style: DecorStyle) {
    setDraft(prev => ({ ...prev, fence: style, gate: style, sign: style, lettering: style }));
  }
  const clean = normalizeDecor(draft);
  const changed = clean.text !== saved.text || parts.some(([part]) => clean[part] !== saved[part]);
  return <>
    <fieldset className="decor-presets"><legend>庭院套系</legend><div className="decor-cards">
      {DECOR_STYLES.map(style => <button type="button" key={style.id} aria-pressed={style === match} onClick={() => chooseStyle(style.id)}>
        <img src={`${import.meta.env.BASE_URL}decor/${style.id}.webp`} alt="" />
        <strong>{style.name}</strong>
        <span aria-hidden="true" className="decor-palette">{style.colors.map(color => <i key={color} style={{ backgroundColor: color }}/>)}</span>
      </button>)}
    </div></fieldset>
    <fieldset className="decor-parts"><legend>部件混搭</legend>
      <div>{parts.map(([key, name]) => <label key={key}>{name}
        <select value={draft[key]} onChange={e => set(key, e.target.value)}>
          {DECOR_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>)}</div></fieldset>
    <label className="field"><span className="field-label">招牌文字 <small>最多 12 个字</small></span>
      <input value={draft.text} placeholder="TT农场" onChange={e => set("text", Array.from(e.target.value).slice(0, 12).join(""))} /></label>
    <div className={`sign-sample sign-${draft.sign} letters-${draft.lettering}`} aria-label="牌匾预览">{clean.text}</div>
    <footer className="closet-footer">
      <button className="btn primary" disabled={!changed} onClick={() => { useGame.getState().setDecor(clean); onClose(); }}>保存庭院装饰</button>
    </footer>
  </>;
}
