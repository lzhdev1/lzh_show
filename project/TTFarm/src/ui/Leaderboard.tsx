import { useEffect, useRef, useState } from "react";
import { flushActive } from "../game/account";
import { ttfarmApi, type CoinLeaderboardEntry } from "../api/client";
import { CloseIcon, CoinIcon } from "./icons";
import { enterVisit } from "../game/social";

export function TrophyIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true" stroke="#8b6026" strokeWidth="1.45" strokeLinejoin="round">
    <path d="M7 5H3v2.1c0 3.4 2.1 5.4 5.7 5.4M17 5h4v2.1c0 3.4-2.1 5.4-5.7 5.4" />
    <path d="M6.8 3.5h10.4v4.9c0 3.8-2.1 6.2-5.2 6.2s-5.2-2.4-5.2-6.2z" fill="#f4c15d"/>
    <path d="M12 15v3.7m-4 1.6h8" strokeWidth="2.2" strokeLinecap="round"/><path d="M9 5.5h5.2" stroke="#fff1bc" strokeLinecap="round"/>
  </svg>;
}

export function Leaderboard({ token, onClose }: { token: string; onClose: () => void }) {
  const [entries, setEntries] = useState<CoinLeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [visitError, setVisitError] = useState("");
  const visitRequest = useRef<AbortController | null>(null);
  useEffect(() => () => visitRequest.current?.abort(), []);
  const spectate = async (row: CoinLeaderboardEntry) => {
    if (visitRequest.current) return;
    const controller = new AbortController();
    visitRequest.current = controller;
    setVisiting(row.userId); setVisitError("");
    try {
      await enterVisit(String(row.userId), "spectate", controller.signal);
      if (!controller.signal.aborted) onClose();
    } catch (error) {
      if (!controller.signal.aborted) setVisitError(error instanceof Error ? error.message : "暂时无法参观");
    } finally {
      visitRequest.current = null;
      if (!controller.signal.aborted) setVisiting(null);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setEntries(null);
    (async () => {
      await flushActive();
      if (controller.signal.aborted) return;
      const result = await ttfarmApi.leaderboard(token, controller.signal);
      if (!controller.signal.aborted) setEntries(result.entries);
    })().catch(() => { if (!controller.signal.aborted) setError("暂时无法读取排行榜"); });
    return () => controller.abort();
  }, [token, refresh]);

  return <div className="modal-scrim" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="leader-title" className="modal ranking-modal" onClick={e => e.stopPropagation()}>
      <header className="modal-head"><TrophyIcon /><h2 id="leader-title">金币排行榜</h2>
        <button className="icon-btn ghost" aria-label="关闭" onClick={onClose}><CloseIcon /></button></header>
      <p className="modal-sub">点击上榜农场主，可用自由镜头参观农场与牧场。</p>
      {visitError && <p role="alert" className="social-alert">{visitError}</p>}
      {error ? <p role="alert" className="ranking-state">{error} <button className="btn plain" onClick={() => setRefresh(r => r + 1)}>重试</button></p>
        : entries === null ? <p role="status" className="ranking-state">正在读取榜单…</p>
        : entries.length === 0 ? <p className="ranking-state">还没有可排名的农场主。</p>
        : <table className="leader-table"><thead><tr><th scope="col">名次</th><th scope="col">农场主</th><th scope="col">金币</th></tr></thead>
          <tbody>{entries.map(row => <tr key={row.userId} className={row.isMe ? "mine" : ""}>
            <td><span className="rank-number" data-rank={row.rank}>{row.rank}</span></td>
            <td><button className="rank-visit" disabled={visiting !== null} onClick={() => void spectate(row)}
              aria-label={`自由参观${row.nickname}的农场和牧场`}>{row.nickname}{row.isMe && <small>我</small>}
              <span aria-hidden="true">{visiting === row.userId ? "…" : "›"}</span></button></td><td><CoinIcon />{row.coins.toLocaleString("zh-CN")}</td>
          </tr>)}</tbody></table>}
    </section>
  </div>;
}
