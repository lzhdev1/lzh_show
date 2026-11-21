import { useCallback, useEffect, useRef, useState } from "react";
import { AVATARS } from "../game/appearance";
import { changeFriend, enterVisit, listFriends, type FriendUser } from "../game/social";
import { FarmApiError } from "../api/client";
import { CloseIcon } from "./icons";

const explain = (error: unknown) => error instanceof Error ? error.message : "连接失败，请稍后重试";

export function FriendsIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="15.8" cy="7.7" r="2.8" fill="#e6bc78" stroke="#8b6844"/>
    <path d="M14.1 13c3.3-1.4 6.9.8 7.2 4.2v1.1h-5.5" fill="#f2d298" stroke="#8b6844"/>
    <circle cx="9" cy="8.4" r="3.6" fill="#c7d8a2" stroke="#567747"/>
    <path d="M2.4 19.7v-1.6a6.6 6.6 0 0 1 13.2 0v1.6Z" fill="#bbd698" stroke="#567747"/>
  </svg>;
}

export function useFriendRoster(token: string | null, open: boolean) {
  const [users, setUsers] = useState<FriendUser[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => { setUsers(null); setError(""); }, [token]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let timer = 0;
    async function poll() {
      try {
        if (document.hidden) return;
        const result = await listFriends(token!, "", controller.signal);
        if (!controller.signal.aborted) { setUsers(result.users); setError(""); }
      } catch (error) {
        if (!controller.signal.aborted) setError(explain(error));
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, open ? 6500 : 25000);
      }
    }
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [token, version, open]);
  return { users, error, refresh };
}

export function FriendsTrigger({ count, onClick }: { count: number; onClick: () => void }) {
  return <button className="ranch-trigger friends-trigger" onClick={onClick} aria-label={count ? `好友，${count} 个待处理申请` : "打开好友"}>
    <FriendsIcon/><b>好友</b>{count > 0 && <span className="request-count">{count > 99 ? "99+" : count}</span>}
  </button>;
}

export function FriendsPanel({ token, roster, onClose }: {
  token: string;
  roster: ReturnType<typeof useFriendRoster>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim();
  const [results, setResults] = useState<FriendUser[] | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [managing, setManaging] = useState<string | null>(null);
  const life = useRef(new AbortController());
  useEffect(() => () => life.current.abort(), []);
  useEffect(() => {
    setResults(null); setSearchError("");
    if (!term) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await listFriends(token, term, controller.signal);
        if (!controller.signal.aborted) setResults(result.users);
      } catch (error) { if (!controller.signal.aborted) setSearchError(explain(error)); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [token, term, searchVersion]);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setActionError(""); setNotice("");
    try { await task(); }
    catch (error) { if (!life.current.signal.aborted) setActionError(explain(error)); }
    finally { if (!life.current.signal.aborted) setBusy(false); }
  };
  const update = (user: FriendUser, action: Parameters<typeof changeFriend>[2]) => void run(async () => {
    const allow = action === "grant" ? !user.grant : undefined;
    try {
      await changeFriend(token, user, action, allow);
    } catch (error) {
      if (error instanceof FarmApiError && error.status === 409 && !life.current.signal.aborted) {
        roster.refresh();
        setSearchVersion(n => n + 1);
      }
      throw error;
    }
    if (life.current.signal.aborted) return;
    roster.refresh();
    setSearchVersion(n => n + 1);
    const messages = { request: "已发送好友申请", accept: "已成为好友", decline: user.status === "outgoing" ? "已撤回申请" : "已婉拒申请",
      grant: allow ? "已允许对方协作" : "已收回协作权限", remove: "已解除好友关系" };
    if (action === "remove") setManaging(null);
    setNotice(messages[action]);
  });
  const visit = (user: FriendUser) => void run(async () => {
    await enterVisit(user.id, "friend", life.current.signal);
    if (!life.current.signal.aborted) onClose();
  });

  const row = (user: FriendUser) => <li className="friend-row" key={user.id}>
    <img className="friend-portrait" src={(AVATARS.find(avatar => avatar.id === user.avatarId) ?? AVATARS[0]).portrait} alt=""/>
    <div className="friend-name"><strong title={user.nickname}>{user.nickname}</strong></div>
    <div className="friend-actions">
      {user.status === "none" && <button className="btn mini" disabled={busy} onClick={() => update(user, "request")}>加好友</button>}
      {user.status === "outgoing" && <><span className="friend-pending">等待回应</span>
        <button className="friend-more" disabled={busy} onClick={() => update(user, "decline")} aria-label={`撤回给${user.nickname}的申请`}>撤回</button></>}
      {user.status === "incoming" && <>
        <button className="btn soft mini" disabled={busy} onClick={() => update(user, "decline")}>婉拒</button>
        <button className="btn primary mini" disabled={busy} onClick={() => update(user, "accept")}>接受</button>
      </>}
      {user.status === "friend" && <>
        <button className="friend-grant" role="switch" aria-checked={user.grant} disabled={busy}
          aria-label={`允许${user.nickname}协作`} onClick={() => update(user, "grant")}><i aria-hidden="true"/>允许协作</button>
        <button className="btn primary mini" disabled={busy} onClick={() => visit(user)}>串门</button>
        <button className="friend-more" disabled={busy} aria-label={`管理好友${user.nickname}`} aria-expanded={managing === user.id}
          onClick={() => setManaging(current => current === user.id ? null : user.id)}>
          <svg viewBox="0 0 20 20" width="17" height="17" fill="currentColor" aria-hidden="true">
            <circle cx="3.5" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="16.5" cy="10" r="1.7"/>
          </svg>
        </button>
      </>}
    </div>
    {user.status === "friend" && managing === user.id && <div className="friend-extra">
      <small>解除后，双方将无法再通过好友串门。</small>
      <button className="friend-remove" disabled={busy} onClick={() => update(user, "remove")}>解除好友</button>
    </div>}
  </li>;
  const sections = term ? [{ title: "搜索结果", list: results ?? [] }] : [
    { title: "收到的申请", list: roster.users?.filter(item => item.status === "incoming") ?? [] },
    { title: "我的好友", list: roster.users?.filter(item => item.status === "friend") ?? [] },
    { title: "已发出的申请", list: roster.users?.filter(item => item.status === "outgoing") ?? [] },
  ];
  const loading = term ? results === null : roster.users === null;
  const readError = term ? searchError : roster.error;
  return <div className="modal-scrim" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="friends-title" className="modal friends-panel" onClick={e => e.stopPropagation()}>
      <header className="modal-head"><FriendsIcon/><h2 id="friends-title">农场好友</h2><button className="icon-btn ghost" onClick={onClose} aria-label="关闭好友"><CloseIcon/></button></header>
      <label className="friend-search">
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.7"/><path d="m13 13 4.3 4.3"/></svg>
        <input type="search" aria-label="按昵称搜索好友" placeholder="搜索农场主昵称" value={query}
          onChange={e => { setQuery(e.target.value); setNotice(""); setActionError(""); }}/>
      </label>
      {actionError && <p className="social-alert" role="alert">{actionError}</p>}
      {notice && <p className="social-notice" role="status">{notice}</p>}
      {readError ? <p className="social-alert" role="alert">{readError} <button className="btn mini" onClick={() => term ? setSearchVersion(n => n + 1) : roster.refresh()}>重试</button></p>
        : loading ? <p className="friend-empty" role="status">{term ? "正在查找农场主…" : "正在读取好友…"}</p>
        : sections.every(section => !section.list.length) ? <p className="friend-empty">{term ? "没有找到这个昵称的农场主。" : "搜索对方的昵称，发送第一份好友申请。"}</p>
        : sections.filter(section => section.list.length > 0).map(section => <section className="friend-group" key={section.title}>
          <h3>{section.title}<small>{section.list.length}</small></h3><ul>{section.list.map(row)}</ul>
        </section>)}
      {sections.some(section => section.list.some(user => user.status === "friend")) && <p className="friend-help">打开「允许协作」，这位好友就能在你的农场播种、浇水、收获和收服动物。种子、收成和动物都归你的农场。</p>}
    </section>
  </div>;
}
