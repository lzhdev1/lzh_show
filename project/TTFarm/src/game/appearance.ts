import { isCouture, type CoutureId } from "./couture";

export type AvatarId = "xiaosui" | "qinghe";
export type BasicOutfitId = "field" | "raincoat" | "ranger";
export type OutfitId = BasicOutfitId | CoutureId;

const portrait = (name: string) => `${import.meta.env.BASE_URL}avatars/${name}.jpg`;

export interface AvatarOption {
  id: AvatarId;
  name: string;
  gender: string;
  portrait: string;
  model: string;
}
export const AVATARS: AvatarOption[] = [
  { id: "xiaosui", name: "小穗", gender: "女", portrait: portrait("xiaosui-face"), model: "xiaosui.vrm" },
  { id: "qinghe", name: "青禾", gender: "男", portrait: portrait("qinghe"), model: "xiaosui.vrm" },
];

export const OUTFITS: { id: BasicOutfitId; name: string }[] = [
  { id: "field", name: "麦田工装" },
  { id: "raincoat", name: "柠檬雨衣" },
  { id: "ranger", name: "山林巡护装" },
];

export const avatarIdOf = (value: unknown): AvatarId => value === "qinghe" ? value : "xiaosui";
const isBasicOutfit = (value: unknown): value is BasicOutfitId =>
  value === "field" || value === "raincoat" || value === "ranger";

export const outfitIdOf = (value: unknown, fallback: OutfitId = "field"): OutfitId =>
  isBasicOutfit(value) || isCouture(value) ? value : fallback;

export function normalizeAppearance(avatar: unknown, top: unknown, bottom: unknown) {
  const avatarId = avatarIdOf(avatar);
  const selected = outfitIdOf(top);
  const outfitId = avatarId === "qinghe" && isCouture(selected) ? "field" : selected;
  const bottomId = isCouture(outfitId) || !isBasicOutfit(bottom) ? outfitId : bottom;
  return { avatarId, outfitId, bottomId };
}

export const BOTTOM_NAMES: Record<BasicOutfitId, string> = {
  field: "田间工装", raincoat: "防水裤与雨靴", ranger: "巡护长裤与皮靴",
};

export const outfitPreview = (avatar: AvatarId, outfit: OutfitId, bottom: OutfitId, back = false) =>
  `${import.meta.env.BASE_URL}avatars/wardrobe/${avatar}-${outfit}${bottom === outfit ? "" : "-" + bottom}${back && isCouture(outfit) ? "-back" : ""}.webp`;
