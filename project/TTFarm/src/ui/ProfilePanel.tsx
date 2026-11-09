import { useRef, useState } from "react";
import { levelFromXp } from "../game/crops";
import { AVATARS, useGame } from "../game/state";
import { getCustomModel, setCustomModel } from "../scene/avatarModel";
import { useAccount } from "../game/account";
import { CloseIcon } from "./icons";

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const nickname = useGame((s) => s.nickname);
  const xp = useGame((s) => s.xp);
  const setProfile = useGame((s) => s.setProfile);
  const resetSave = useGame((s) => s.resetSave);
  const notify = useGame((s) => s.notify);
  const user = useAccount((s) => s.user);

  const [draftName, setDraftName] = useState(nickname);
  const [modelLabel, setModelLabel] = useState(getCustomModel().label);
  const fileRef = useRef<HTMLInputElement>(null);
  const level = levelFromXp(xp);
  const changed = draftName.trim() !== nickname;
  const avatar = AVATARS[0];

  const save = () => {
    setProfile(draftName, avatar.id);
    onClose();
  };

  const reset = () => {
    if (window.confirm("重置会清空金币、地块和收成，确定要重来吗？")) {
      resetSave();
      onClose();
    }
  };

  const pickModel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vrm")) {
      notify("请选择 VRoid 导出的 .vrm 文件", "warn");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      notify("模型太大了（超过 40MB），先精简贴图再导", "warn");
      return;
    }
    setCustomModel(URL.createObjectURL(file), file.name);
    setModelLabel(file.name);
    notify(`已载入模型：${file.name}`);
  };

  const clearModel = () => {
    setCustomModel(null);
    setModelLabel(null);
    notify("已回到内置形象");
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

        <h3 className="section-title">当前形象</h3>
        <div className="avatar-grid single">
          <div className="avatar-card active static">
            <img src={avatar.portrait} alt={avatar.name} loading="lazy" />
            <strong>{avatar.name}</strong>
            <span className="muted small">{avatar.tagline}</span>
          </div>
        </div>

        <h3 className="section-title">导入自己的 3D 模型</h3>
        <div className="avatar-import">
          <p className="muted small">
            在 VRoid Studio 里捏好、导出 .vrm 后选进来就能当场替换角色（仅本次打开有效，刷新后回到内置形象）。
          </p>
          <div className="import-actions">
            <button className="btn plain" onClick={() => fileRef.current?.click()}>
              选择 .vrm 文件
            </button>
            {modelLabel && (
              <button className="btn plain" onClick={clearModel}>
                恢复内置形象
              </button>
            )}
          </div>
          {modelLabel && <p className="small">当前模型：{modelLabel}</p>}
          <input ref={fileRef} type="file" accept=".vrm" hidden onChange={pickModel} />
        </div>

        <h3 className="section-title">账号</h3>
        <div className="account-row">
          <span className="account-name">{user?.nickname ?? "未登录"}</span>
          <span className="muted small">进度已存在数据库里</span>
          <button className="btn plain" onClick={() => useAccount.getState().signOut()}>
            退出登录
          </button>
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
