import { useState } from "react";
import { levelFromXp } from "../game/crops";
import { AVATARS, useGame, type AvatarId } from "../game/state";
import { CloseIcon } from "./icons";

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const nickname = useGame((s) => s.nickname);
  const avatarId = useGame((s) => s.avatarId);
  const xp = useGame((s) => s.xp);
  const setProfile = useGame((s) => s.setProfile);
  const resetSave = useGame((s) => s.resetSave);

  const [draftName, setDraftName] = useState(nickname);
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>(avatarId);
  const level = levelFromXp(xp);
  const changed = draftName.trim() !== nickname || draftAvatar !== avatarId;

  const save = () => {
    setProfile(draftName, draftAvatar);
    onClose();
  };

  const reset = () => {
    if (window.confirm("重置会清空金币、地块和收成，确定要重来吗？")) {
      resetSave();
      onClose();
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>农场主资料</h2>
          <button className="icon-btn ghost" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="modal-sub">昵称和形象随时可以改，存档会记住你的选择</p>

        <label className="field">
          <span className="field-label">昵称</span>
          <input
            type="text"
            value={draftName}
            maxLength={12}
            placeholder="给自己起个名字"
            onChange={(e) => setDraftName(e.target.value)}
          />
          <span className="field-hint muted small">最多 12 个字 · 当前 Lv{level}</span>
        </label>

        <h3 className="section-title">更换形象</h3>
        <div className="avatar-grid">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              className={draftAvatar === avatar.id ? "avatar-card active" : "avatar-card"}
              onClick={() => setDraftAvatar(avatar.id)}
            >
              <img src={avatar.portrait} alt={avatar.name} loading="lazy" />
              <strong>{avatar.name}</strong>
              <span className="muted small">{avatar.tagline}</span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn plain" onClick={reset}>
            重置存档
          </button>
          <button className="btn primary" onClick={save} disabled={!changed}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
