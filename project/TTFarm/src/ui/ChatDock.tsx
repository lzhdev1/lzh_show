import { useEffect, useRef, useState } from "react";
import { sendChat, useChat, CHAT_LIMIT } from "../game/chat";
import { useAccount } from "../game/account";
import { DriveDock } from "./DriveDock";

function clockOf(at: number) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * 房间发言：点按钮弹出「历史 + 输入」的卡片。
 * 消息同时会以头顶气泡显示 30 秒，聊天记录只保留当前房间。
 */
export function ChatDock() {
  const [open, setOpen] = useState(false);
  const messages = useChat(state => state.messages);
  const room = useChat(state => state.room);
  const selfId = useAccount(state => String(state.user?.id ?? ""));
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) setOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, messages.length]);

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await sendChat(text);
      setText("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "发送失败，稍后再试");
    } finally {
      setSending(false);
    }
  };

  return <div className={`chat-dock${open ? " open" : ""}`}>
    {open && <section className="chat-card" aria-label="房间消息">
      <header className="chat-head">
        <b>房间消息</b>
        <button type="button" className="chat-close" aria-label="收起发言" onClick={() => setOpen(false)}>收起</button>
      </header>
      <div className="chat-list" ref={list}>
        {messages.length === 0 ? <p className="chat-empty">还没有人说话。打个招呼吧。</p> : messages.map(message =>
          <p key={message.id} className={`chat-line${message.userId === selfId ? " mine" : ""}`}>
            <span className="chat-meta">{message.userId === selfId ? "我" : message.nickname} · {clockOf(message.at)}</span>
            <span className="chat-body">{message.body}</span>
          </p>)}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <div className="chat-compose">
        <input ref={input} value={text} maxLength={CHAT_LIMIT} placeholder="说点什么…"
          aria-label="输入要发送的内容" disabled={!room}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void submit(); }} />
        <button type="button" className="chat-send" disabled={sending || !text.trim()} onClick={() => void submit()}>发送</button>
      </div>
    </section>}
    <DriveDock />
    <button type="button" className="chat-toggle" aria-expanded={open} aria-label="发言"
      onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">💬</span><b>发言</b>
    </button>
  </div>;
}
