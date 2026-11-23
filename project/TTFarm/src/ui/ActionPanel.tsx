import { useEffect, useRef, useState } from "react";
import { ACTIONS, MENU_ACTION_IDS } from "../scene/actionMotion";
import { requestAction, requestStopAction, useAction } from "../game/actionStore";

/** 左上角「动作」入口：弹层里 7 个动作，键盘快捷键与按钮等价。 */
export function ActionTrigger() {
  const [open, setOpen] = useState(false);
  const current = useAction(s => s.current);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const outside = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return <div className="action-menu" ref={wrap}>
    <button type="button" className="ranch-trigger action-trigger" aria-expanded={open}
      aria-label="角色动作" title="出拳、踢腿与表情动作" onClick={() => setOpen(!open)}>
      <span className="action-trigger-icon" aria-hidden="true">{current ? ACTIONS[current].icon : "🤸"}</span>
      <span>{current ? ACTIONS[current].label : "动作"}</span>
    </button>
    {open && <div className="action-pop" role="menu" aria-label="角色动作列表">
      {MENU_ACTION_IDS.map(id => {
        const meta = ACTIONS[id];
        const active = current === id;
        return <button key={id} type="button" role="menuitem" className="action-item" aria-pressed={active}
          onClick={() => { if (active) requestStopAction(); else requestAction(id); }}>
          <span className="action-emoji" aria-hidden="true">{meta.icon}</span>
          <span className="action-name">{meta.label}</span>
          <kbd className="action-key">{meta.key}</kbd>
        </button>;
      })}
      <div className="action-foot">
        {current ? <button type="button" className="action-stop" onClick={requestStopAction}>停止动作</button> : <span />}
        <small>移动、跳跃或下水会自动取消</small>
      </div>
    </div>}
  </div>;
}