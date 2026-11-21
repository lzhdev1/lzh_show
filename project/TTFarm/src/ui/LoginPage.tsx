import { useState, type FormEvent } from "react";
import { useAccount } from "../game/account";

const mainSite = new URL("/", window.location.origin);
// Docker publishes the Vite game and the portfolio on separate ports in development.
if (import.meta.env.DEV && mainSite.port === "5174") mainSite.port = "3100";

export function LoginPage() {
  const { user, token, identityChecked, pending, error, signIn, setNickname, signOut, refresh } = useAccount();
  const [username, setUsername] = useState("");
  const [nickname, setName] = useState("");
  const [newAccount, setNewAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const checking = !!token && !identityChecked;
  const choosingName = !checking && (newAccount || !!token && !user?.nickname);
  const busy = pending || saving;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice("");
    if (checking) { await refresh(); return; }
    if (token && choosingName) {
      setSaving(true);
      try { await setNickname(nickname.trim()); }
      catch (err) { setNotice(err instanceof Error ? err.message : "昵称保存失败"); }
      finally { setSaving(false); }
      return;
    }
    const result = await signIn(username.trim(), newAccount ? nickname.trim() : undefined);
    if (result === "missing") setNewAccount(true);
  }

  function back() {
    if (token) signOut();
    setNewAccount(false); setName(""); setNotice("");
    useAccount.setState({error:""});
  }

  return <div className="login-layer"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><span className="login-logo" aria-hidden="true"/><div>
      <h1>{choosingName ? "取个农场昵称" : "TT 农场"}</h1>
      <p>{choosingName ? "好友会用这个名字找到你。" : checking ? "正在读取你的农场资料" : "输入用户名，回到自己的农场。"}</p>
    </div></div>
    {!checking && (choosingName ? <label className="login-field" key="nickname">
      <span>游戏昵称</span>
      <input autoFocus required value={nickname} autoComplete="nickname" spellCheck={false}
        onChange={e => { setName(e.target.value); setNotice(""); }} placeholder="选一个独一无二的名字，最多 16 个字符"/>
    </label> : <label className="login-field" key="username">
      <span>用户名</span>
      <input autoFocus required value={username} onChange={e => setUsername(e.target.value)}
        maxLength={16} placeholder="2–16 位中文、字母、数字或下划线" autoComplete="username" spellCheck={false}/>
    </label>)}
    {(notice || error) && <p className="login-error" role="alert">{notice || error}</p>}
    <button type="submit" className="login-primary" disabled={busy || !checking && !(choosingName ? nickname : username).trim()}>
      {busy ? "正在进入…" : checking ? "重新连接" : choosingName ? "保存昵称并进入" : "进入农场"}
    </button>
    <div className="login-switch">
      {(choosingName || checking && !busy) && <button type="button" disabled={busy} onClick={back}>返回选择账号</button>}
      <a className="login-home" href={mainSite.href} target="_top"><span aria-hidden="true">←</span> 返回主站</a>
    </div>
    {!choosingName && !checking && <p className="login-note">首次使用的用户名会在下一步创建农场，并设置游戏昵称。</p>}
  </form></div>;
}
