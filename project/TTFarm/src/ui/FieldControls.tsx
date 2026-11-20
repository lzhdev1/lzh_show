import { useEffect, useRef, useState, type PointerEvent } from "react";
import { farmInput, releaseStick } from "../game/input";
import { getRainSoundEnabled, getRiverSoundEnabled, setRainSoundEnabled, setRiverSoundEnabled } from "../game/riverSoundSetting";
import { useClock } from "../game/clock";
import { WEATHER, weatherAt, weatherEndsAt, type WeatherKind } from "../game/weather";

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {kind === "sunny" ? <>
        <circle cx="16" cy="16" r="6" fill="#ffce69" stroke="#a36b2d" strokeWidth="1.4" />
        <path stroke="#b47729" strokeWidth="2" d="M16 3v3m0 20v3M3 16h3m20 0h3M7 7l2.3 2.3m13.4 13.4L25 25M7 25l2.3-2.3M22.7 9.3 25 7" />
      </> : <>
        <path d="M8 21a5.8 5.8 0 0 1-1-11.4 8 8 0 0 1 15.3.4A5.5 5.5 0 1 1 24 21Z" fill={kind === "rain" ? "#97b9cd" : "#e1e8df"} stroke="#597584" strokeWidth="1.6" />
        {kind === "rain" && <path d="m10 24-2 4m9-4-2 4m9-4-2 4" stroke="#548eae" strokeWidth="2" />}
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
      <p>轻点地块可前往种植或收获。</p>
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
        }}>雨声{rainEnabled ? "开" : "关"}</button>
      </div>
    </div>}
  </div>;
}

export function TouchControls() {
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
    <div ref={stick} className="touch-stick" aria-label="移动摇杆，推至外圈奔跑"
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
    <button type="button" className="jump-control" aria-label="跳跃"
      onPointerDown={(e) => { if (e.button === 0) farmInput.jump = true; }}
      onClick={(e) => { if (e.detail === 0) farmInput.jump = true; }}>
      <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6m-6-6v12M5 21h14"/></svg>
      <span>跳跃</span>
    </button>
  </div>;
}
