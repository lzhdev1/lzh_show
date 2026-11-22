import { useEffect, useRef, useState, type PointerEvent } from "react";
import { farmInput, releaseStick } from "../game/input";
import { getRainSoundEnabled, getRiverSoundEnabled, setRainSoundEnabled, setRiverSoundEnabled } from "../game/riverSoundSetting";
import { useClock } from "../game/clock";
import { useAccount } from "../game/account";
import { WEATHER, weatherAt, weatherEndsAt, type WeatherKind } from "../game/weather";

export function ReturnToLoginButton() {
  const signOut = useAccount(state => state.signOut);
  return <button type="button" className="ranch-trigger login-return" onClick={signOut}
    aria-label="返回登录页" title="返回登录页">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8M4 12h11M8 8l-4 4 4 4"/>
    </svg>
    <span><span className="return-verb">返回</span>登录页</span>
  </button>;
}

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {kind === "sunny" ? <>
        <circle cx="16" cy="16" r="6" fill="#ffce69" stroke="#a36b2d" strokeWidth="1.4" />
        <path stroke="#b47729" strokeWidth="2" d="M16 3v3m0 20v3M3 16h3m20 0h3M7 7l2.3 2.3m13.4 13.4L25 25M7 25l2.3-2.3M22.7 9.3 25 7" />
      </> : kind === "gale" ? <g stroke="#679a91" strokeWidth="2.4">
        <path d="M3 12h16c6 0 6-8 1-8-2 0-3 1-3 3M4 17h21c5 0 5 7 1 7M7 22h8c5 0 5 7 1 7"/>
      </g> : <>
        <path d="M8 21a5.8 5.8 0 0 1-1-11.4 8 8 0 0 1 15.3.4A5.5 5.5 0 1 1 24 21Z" fill={kind === "rain" ? "#97b9cd" : "#e1e8df"} stroke="#597584" strokeWidth="1.6" />
        {kind === "rain" && <path d="m10 24-2 4m9-4-2 4m9-4-2 4" stroke="#548eae" strokeWidth="2" />}
        {kind === "storm" && <path d="m18 17-7 9h5l-2 5 9-11h-6z" fill="#ffd864" stroke="#9b7335"/>}
        {kind === "snow" && <path d="M10 22v8m-3.4-6 6.8 4m-6.8 0 6.8-4M23 21v7m-3-5.2 6 3.4m-6 0 6-3.4" stroke="#569ab5" strokeWidth="1.5"/>}
        {kind === "fog" && <path d="M3 20h22M7 24h22M3 28h18" stroke="#799397" strokeWidth="2.3"/>}
      </>}
    </svg>
  );
}

export function WeatherBadge({ onOpen }: { onOpen: () => void }) {
  const now = useClock((s) => Math.floor(s.now / 1000) * 1000);
  const kind = weatherAt(now);
  const seconds = Math.max(0, Math.ceil((weatherEndsAt(now) - now) / 1000));
  return <button type="button" onClick={onOpen} className="weather-badge" aria-label={`查看田间气象，当前${WEATHER[kind].label}`} title="查看天气预报与变异概率">
    <WeatherIcon kind={kind} />
    <span><b>{WEATHER[kind].label}</b><small>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</small></span>
  </button>;
}

export function ControlGuide() {
  const [open, setOpen] = useState(false);
  const [riverEnabled, setRiverEnabled] = useState(getRiverSoundEnabled);
  const [rainEnabled, setRainEnabled] = useState(getRainSoundEnabled);
  return <div className="control-guide">
    <button type="button" className="guide-trigger" aria-label="操作说明" aria-expanded={open} onClick={() => setOpen(!open)}>?</button>
    {open && <div className="guide-copy">
      <p className="desktop-guide"><b>移动</b> WASD / 方向键<br/><b>奔跑</b> 按住 Shift　<b>跳跃</b> 空格<br/><b>镜头</b> 左键或右键拖动，Q / E 左右转，滚轮缩放</p>
      <p className="touch-guide"><b>移动</b> 拖动左侧摇杆，推到外圈奔跑<br/><b>跳跃</b> 点右侧跳跃键<br/><b>镜头</b> 按住摇杆时，另一指划动画面转向，在画面上双指捏合缩放</p>
      <p><b>种菜</b> 点选下方种子，走到菜地上点「撒种」。生长时可浇水，作物上方出成熟标志后，走到那块地上点「收获」。</p>
      <p><b>采野菜</b> 野外每 10 分钟长出一批野菜丛，走近点「采摘」获得野菜，还有机会捡到种子种回农场。「农场 → 野外野菜」可以带路。</p>
      <p><b>动作</b> J 出拳　K 踢腿　C 欢呼　X 跳舞　Z 坐下　V 躺下　B 晕倒，也可以点左上角「动作」按钮；移动或跳跃会取消动作。</p>
      <p>走进深水会自动游泳，停下会踩水，靠岸后恢复步行。</p>
      <div className="guide-actions">
        <button onClick={() => {
          window.dispatchEvent(new Event("ttfarm:reset-camera"));
          setOpen(false);
        }}>镜头复位</button>
        <button aria-pressed={riverEnabled} onClick={() => {
          setRiverSoundEnabled(!riverEnabled);
          setRiverEnabled(!riverEnabled);
        }}>流水声{riverEnabled ? "开" : "关"}</button>
        <button aria-pressed={rainEnabled} onClick={() => {
          setRainSoundEnabled(!rainEnabled);
          setRainEnabled(!rainEnabled);
        }}>风雨雷声{rainEnabled ? "开" : "关"}</button>
      </div>
      <p><a href={`${import.meta.env.BASE_URL}credits/animals.html`} target="_blank" rel="noopener noreferrer">动物模型署名与许可</a></p>
    </div>}
  </div>;
}

export function TouchControls({ spectating = false }: { spectating?: boolean } = {}) {
  const active = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0, radius: 1 });
  const stick = useRef<HTMLDivElement>(null);
  const release = () => {
    active.current = null;
    releaseStick();
    stick.current?.style.removeProperty("--stick-x");
    stick.current?.style.removeProperty("--stick-y");
    stick.current?.removeAttribute("data-running");
  };
  useEffect(() => {
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      release();
    };
  }, []);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (active.current !== e.pointerId) return;
    const { x, y, radius } = origin.current;
    const dx = (e.clientX - x) / radius;
    const dy = (e.clientY - y) / radius;
    const distance = Math.hypot(dx, dy);
    const magnitude = Math.min(1, Math.max(0, (distance - 0.10) / 0.90));
    farmInput.x = distance ? dx / distance * magnitude : 0;
    farmInput.forward = distance ? -dy / distance * magnitude : 0;
    farmInput.running = magnitude >= (farmInput.running ? 0.77 : 0.9);
    e.currentTarget.toggleAttribute("data-running", farmInput.running);
    const clamp = Math.max(1, distance);
    e.currentTarget.style.setProperty("--stick-x", `${dx / clamp * radius}px`);
    e.currentTarget.style.setProperty("--stick-y", `${dy / clamp * radius}px`);
  };

  return <div className="touch-controls">
    <div ref={stick} className="touch-stick" aria-label={spectating ? "自由镜头平移摇杆" : "移动摇杆，推至外圈奔跑"}
      onPointerDown={(e) => {
        if (active.current !== null || e.button !== 0) return;
        active.current = e.pointerId;
        farmInput.steering = true;
        const b = e.currentTarget.getBoundingClientRect();
        origin.current = { x: b.left + b.width / 2, y: b.top + b.height / 2, radius: b.width * 0.32 };
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }} onPointerMove={move}
      onLostPointerCapture={(e) => { if (e.pointerId === active.current) release(); }}
      onPointerUp={(e) => { if (e.pointerId === active.current) release(); }}
      onPointerCancel={(e) => { if (e.pointerId === active.current) release(); }}>
      <span className="stick-thumb" />
    </div>
    {!spectating && <button type="button" className="jump-control" aria-label="跳跃"
      onPointerDown={(e) => { if (e.button === 0) farmInput.jump = true; }}
      onClick={(e) => { if (e.detail === 0) farmInput.jump = true; }}>
      <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6m-6-6v12M5 21h14"/></svg>
      <span>跳跃</span>
    </button>}
  </div>;
}
