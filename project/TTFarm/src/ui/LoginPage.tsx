import { useState } from "react";
import { useAccount } from "../game/account";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const pending = useAccount((s) => s.pending);
  const error = useAccount((s) => s.error);
  const signIn = useAccount((s) => s.signIn);

  const submit = async () => {
    if (pending) return;
    const name = username.trim();
    if (!name) return;
    await signIn(name, mode);
  };

  return (
    <div className="login-layer">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo" />
          <div>
            <h1>TT 农场</h1>
            <p>种田、扩建，进度跟着账号走</p>
          </div>
        </div>

        <label className="login-field">
          <span>账号</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="2-16 位中文、字母、数字或下划线"
            maxLength={16}
            autoFocus
            spellCheck={false}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-primary" onClick={() => void submit()} disabled={pending || !username.trim()}>
          {pending ? "正在进农场…" : mode === "login" ? "进入农场" : "注册并进入"}
        </button>

        <div className="login-switch">
          {mode === "login" ? (
            <>
              <span>还没有账号？</span>
              <button
                onClick={() => {
                  setMode("register");
                  useAccount.setState({ error: "" });
                }}
              >
                注册一个
              </button>
            </>
          ) : (
            <>
              <span>已经有账号？</span>
              <button
                onClick={() => {
                  setMode("login");
                  useAccount.setState({ error: "" });
                }}
              >
                直接登录
              </button>
            </>
          )}
        </div>

        <p className="login-note">
          现在只要填账号就能进，密码字段已经留在库里，等以后要开密码登录再接上。
        </p>
      </div>
    </div>
  );
}
