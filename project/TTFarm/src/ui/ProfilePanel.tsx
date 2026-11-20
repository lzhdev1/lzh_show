import { useRef, useState, type ChangeEvent } from "react";
import { useGame } from "../game/state";
import { AVATARS, BOTTOM_NAMES, OUTFITS, outfitPreview, type OutfitId } from "../game/appearance";
import { getCustomModel, setCustomModel } from "../scene/avatarModel";
import { useAccount } from "../game/account";
import { CloseIcon } from "./icons";

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const nickname = useGame((s) => s.nickname);
  const avatarId = useGame((s) => s.avatarId);
  const outfitId = useGame((s) => s.outfitId);
  const bottomId = useGame((s) => s.bottomId);
  const notify = useGame((s) => s.notify);
  const user = useAccount((s) => s.user);
  const [tab, setTab] = useState<"closet" | "account">("closet");
  const [draftName, setDraftName] = useState(nickname);
  const [actor, setActor] = useState(avatarId);
  const [outfit, setOutfit] = useState(outfitId);
  const [bottom, setBottom] = useState(bottomId);
  const [modelLabel, setModelLabel] = useState(getCustomModel().label);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = AVATARS.find(a => a.id === actor)!;
  const suit = OUTFITS.find(o => o.id === outfit)!;
  const save = () => {
    if (tab === "closet" && modelLabel) setCustomModel(null);
    useGame.getState().setProfile(tab === "account" ? draftName : nickname,
      tab === "closet" ? actor : avatarId, tab === "closet" ? outfit : outfitId, tab === "closet" ? bottom : bottomId);
    onClose();
  };
  const pickModel = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vrm") || file.size > 40 * 1024 * 1024) {
      notify("请选择 40 MB 以内的 .vrm 模型", "warn");
      return;
    }
    setCustomModel(URL.createObjectURL(file), file.name);
    setModelLabel(file.name);
    notify("已选择本次游玩的模型");
  };

  return <div className="modal-scrim" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="profile-title" className="modal wardrobe-modal" onClick={e => e.stopPropagation()}>
      <header className="modal-head"><h2 id="profile-title">农场主</h2>
        <button type="button" className="icon-btn ghost" aria-label="关闭" onClick={onClose}><CloseIcon /></button>
      </header>
      <div className="farm-tabs">
        <button aria-pressed={tab === "closet"} onClick={() => setTab("closet")}>角色衣橱</button>
        <button aria-pressed={tab === "account"} onClick={() => setTab("account")}>账号资料</button>
      </div>
      {tab === "closet" ? <>
        <div className="fitting-room">
          <figure className={`outfit-stage stage-${outfit}`}>
            <img src={outfitPreview(actor, outfit, bottom)} alt={`${avatar.name}穿着${suit.name}上装和${BOTTOM_NAMES[bottom]}下装的全身效果`} />
            <figcaption><strong>{avatar.name}</strong><span>{outfit === bottom ? suit.name : "自选搭配"}</span></figcaption>
          </figure>
          <div className="closet-choices">
            <fieldset><legend>角色</legend><div className="actor-options">
              {AVATARS.map(a => <button key={a.id} aria-pressed={actor === a.id} onClick={() => setActor(a.id)}>
                <img src={a.portrait} alt="" /><span>{a.name}<small>{a.gender}</small></span></button>)}
            </div></fieldset>
            <fieldset><legend>服装套装</legend><div className="suit-options">
              {OUTFITS.map(s => <button key={s.id} onClick={() => { setOutfit(s.id); setBottom(s.id); }} aria-pressed={outfit === s.id}>
                <span className={`fabric fabric-${s.id}`} aria-hidden="true" />{s.name}
                {outfit === s.id && <span className="picked" aria-hidden="true">✓</span>}
              </button>)}
            </div></fieldset>
            <label className="bottom-picker">下装与鞋靴
              <select value={bottom} onChange={e => setBottom(e.target.value as OutfitId)}>
                {OUTFITS.map(s => <option key={s.id} value={s.id}>{BOTTOM_NAMES[s.id]}</option>)}
              </select>
            </label>
          </div>
        </div>
        {modelLabel && <p className="muted small">当前使用导入模型。穿戴后将切换为所选的内置角色。</p>}
        <footer className="closet-footer"><button className="btn primary" onClick={save}
          disabled={actor === avatarId && outfit === outfitId && bottom === bottomId && !modelLabel}>穿戴并保存</button></footer>
      </> : <>
        <label className="field"><span className="field-label">昵称</span>
          <input value={draftName} maxLength={12} onChange={e => setDraftName(e.target.value)} />
        </label>
        <h3 className="section-title">本地 VRM 模型</h3>
        <div className="avatar-import">
          <p className="muted small">{modelLabel ?? "可导入 40 MB 以内的 .vrm 文件，仅在本次游玩中使用。"}</p>
          <div className="import-actions"><button className="btn plain" onClick={() => fileRef.current?.click()}>选择模型</button>
            {modelLabel && <button className="btn plain" onClick={() => { setCustomModel(null); setModelLabel(null); }}>恢复内置形象</button>}</div>
          <input ref={fileRef} type="file" accept=".vrm" hidden onChange={pickModel}/>
        </div>
        <h3 className="section-title">账号</h3>
        <div className="account-row"><strong>{user?.username}</strong>
          <button className="btn plain" onClick={() => { onClose(); useAccount.getState().signOut(); }}>退出登录</button></div>
        <div className="modal-actions">
          <button className="btn plain" onClick={() => {
            if (window.confirm("重置会清空金币、地块、收成和装扮，确定要重来吗？")) {
              useGame.getState().resetSave(); onClose();
            }
          }}>重置存档</button>
          <button className="btn primary" disabled={draftName.trim() === nickname} onClick={save}>保存昵称</button>
        </div>
      </>}
    </section>
  </div>;
}
