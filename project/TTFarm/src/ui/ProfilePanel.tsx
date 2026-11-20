import { useRef, useState, type ChangeEvent } from "react";
import { useGame } from "../game/state";
import { AVATARS, BOTTOM_NAMES, OUTFITS, outfitPreview, type AvatarId, type BasicOutfitId, type OutfitId } from "../game/appearance";
import { COUTURE, isCouture, type CoutureFamily } from "../game/couture";
import { getCustomModel, setCustomModel } from "../scene/avatarModel";
import { useAccount } from "../game/account";
import { CloseIcon } from "./icons";

const collections = {
  basic: "田园日常", petal: "花语", tide: "潮汐", astral: "星夜",
} satisfies Record<"basic" | CoutureFamily, string>;

const collectionIds = ["basic", "petal", "tide", "astral"] as const;
type Collection = (typeof collectionIds)[number];

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
  const [back, setBack] = useState(false);
  const [collection, setCollection] = useState<Collection>(() =>
    COUTURE.find(item => item.id === outfitId)?.family ?? "basic");
  const [modelLabel, setModelLabel] = useState(getCustomModel().label);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = AVATARS.find(a => a.id === actor)!;
  const dress = COUTURE.find(item => item.id === outfit);
  const basicBottom = !isCouture(bottom) ? bottom : "field";
  const suitName = dress?.name ?? OUTFITS.find(item => item.id === outfit)!.name;
  const mixed = !dress && outfit !== bottom;
  const visibleSuits = collection === "basic" ? OUTFITS : COUTURE.filter(item => item.family === collection);
  function trySuit(id: OutfitId) {
    setOutfit(id);
    setBottom(id);
  }
  function chooseActor(id: AvatarId) {
    setActor(id);
    if (id === "qinghe") {
      setCollection("basic");
      if (isCouture(outfit)) trySuit("field");
    }
  }
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
    <section role="dialog" aria-modal="true" aria-labelledby="profile-title" data-tab={tab} className="modal wardrobe-modal" onClick={e => e.stopPropagation()}>
      <header className="modal-head"><h2 id="profile-title">农场主</h2>
        <button type="button" className="icon-btn ghost" aria-label="关闭" onClick={onClose}><CloseIcon /></button>
      </header>
      <div className="farm-tabs">
        <button aria-pressed={tab === "closet"} onClick={() => setTab("closet")}>角色衣橱</button>
        <button aria-pressed={tab === "account"} onClick={() => setTab("account")}>账号资料</button>
      </div>
      {tab === "closet" ? <>
        <div className="closet-toolbar">
          <div className="actor-options" role="group" aria-label="选择角色">
            {AVATARS.map(a => <button type="button" key={a.id} aria-pressed={actor === a.id} onClick={() => chooseActor(a.id)}>
              <img src={a.portrait} alt="" /><span>{a.name}<small>{a.gender}</small></span></button>)}
          </div>
          {actor === "xiaosui" && <div className="collection-options" role="group" aria-label="浏览服饰系列">
            {collectionIds.map(id => <button type="button" key={id} aria-pressed={id === collection}
              onClick={() => setCollection(id)}>{collections[id]}</button>)}
          </div>}
        </div>
        <div className="fitting-room">
          <figure className="outfit-stage" data-family={dress?.family ?? "basic"}>
            <div className="fitting-image">
              <img src={outfitPreview(actor, outfit, bottom, back)}
                alt={`${avatar.name}穿着${suitName}${mixed ? "搭配" + BOTTOM_NAMES[basicBottom] : ""}的${dress && back ? "背面" : "正面"}全身效果`} />
            </div>
            <figcaption aria-live="polite">
              <div className="fitting-caption">
                <span>{avatar.name} · {collections[dress?.family ?? "basic"]}</span>
                {dress && <button type="button" className="reverse-view" onClick={() => setBack(!back)}>
                  {back ? "看正面" : "看背面"}
                </button>}
              </div>
              <strong>{suitName}</strong>
              {dress ? <p>{dress.detail}</p> : mixed && <p>搭配{BOTTOM_NAMES[basicBottom]}</p>}
            </figcaption>
          </figure>
          <div className="closet-choices">
            <fieldset><legend>{collections[collection]}<small>{visibleSuits.length} 款</small></legend>
              <div className="suit-options">
              {visibleSuits.map(s => <button type="button" key={s.id} onClick={() => trySuit(s.id)} aria-pressed={outfit === s.id}>
                <span className="suit-thumbnail" data-family={collection} aria-hidden="true">
                  <img src={outfitPreview(actor, s.id, s.id)} alt="" />
                </span>
                <span className="suit-name">{s.name}{"swatch" in s && typeof s.swatch === "string" &&
                  <i aria-hidden="true" style={{ backgroundColor: s.swatch }} />}</span>
                {outfit === s.id && <span className="picked" aria-hidden="true">✓</span>}
              </button>)}
            </div></fieldset>
            {collection === "basic" && !dress && <label className="bottom-picker">下装与鞋靴
              <select value={basicBottom} onChange={e => setBottom(e.target.value as BasicOutfitId)}>
                {OUTFITS.map(s => <option key={s.id} value={s.id}>{BOTTOM_NAMES[s.id]}</option>)}
              </select>
            </label>}
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
