import { describe, expect, it } from "vitest";
import { bubbleText, mergeChatMessages, useChat, type ChatMessage } from "./chat";

const base = (id: string, body: string, userId = "u1", at = 1000): ChatMessage => ({
  id, userId, nickname: "测试", body, at,
});

describe("chat bubble arrivals", () => {
  it("keeps room history silent after the first baseline and later polls", () => {
    useChat.setState({ room: "r1", messages: [], unread: 0, notice: "" });
    const history = [base("h1", "nihao", "u1", 100), base("h2", "气泡上线检查", "u1", 200)];

    const first = mergeChatMessages([], history, false);
    useChat.setState({ messages: first });
    expect(bubbleText("u1", 5000)).toBeNull();

    // 下一次轮询 primed=true 时也不能把已经在列表里的历史重新记成“刚到达”
    const second = mergeChatMessages(first, history, true);
    useChat.setState({ messages: second });
    expect(bubbleText("u1", 5000)).toBeNull();
  });

  it("bubbles only a genuinely new message and expires after 30s", () => {
    useChat.setState({ room: "r2", messages: [], unread: 0, notice: "" });
    const history = [base("h3", "旧消息", "u1", 100)];
    const first = mergeChatMessages([], history, false);
    const fresh = [base("h4", "新消息", "u1", 200)];
    const next = mergeChatMessages(first, [...history, ...fresh], true);
    useChat.setState({ messages: next });

    const now = Date.now();
    expect(bubbleText("u1", now)).toBe("新消息");
    expect(bubbleText("u1", now + 31_000)).toBeNull();
  });
});
