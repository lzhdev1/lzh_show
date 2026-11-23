import { useEffect, useState, type ReactNode } from "react";

export interface HudMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  onClick: () => void;
}

/**
 * 移动端功能抽屉：主层留农场 / 牧场 / 人物信息，商店放进顶栏，
 * 图鉴、排行、好友、动作、天气、操作说明与返回登录都收进这里。
 */
export function HudMenu({ items, children }: { items: HudMenuItem[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);
  return <>
    <button type="button" className={`hud-menu-trigger${open ? " active" : ""}`} aria-label="功能菜单"
      aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
      <span>菜单</span>
    </button>
    {open && <>
      <div className="hud-menu-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <nav className="hud-menu" aria-label="功能菜单">
        <div className="hud-menu-head">
          <b>功能菜单</b>
          <button type="button" onClick={() => setOpen(false)}>收起</button>
        </div>
        <div className="hud-menu-grid">
          {items.map(item => <button key={item.key} type="button" className="hud-menu-item"
            onClick={() => { setOpen(false); item.onClick(); }}>
            {item.icon && <span className="hud-menu-icon" aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {item.hint && <small>{item.hint}</small>}
          </button>)}
        </div>
        {children && <div className="hud-menu-extra">{children}</div>}
      </nav>
    </>}
  </>;
}
