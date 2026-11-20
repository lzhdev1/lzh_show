export type AvatarId = "xiaosui" | "qinghe";
export type OutfitId = "field" | "raincoat" | "ranger";

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

export const OUTFITS: { id: OutfitId; name: string }[] = [
  { id: "field", name: "麦田工装" },
  { id: "raincoat", name: "柠檬雨衣" },
  { id: "ranger", name: "山林巡护装" },
];

export const avatarIdOf = (value: unknown): AvatarId => value === "qinghe" ? value : "xiaosui";
export const outfitIdOf = (value: unknown, fallback: OutfitId = "field"): OutfitId =>
  value === "field" || value === "raincoat" || value === "ranger" ? value : fallback;

export const BOTTOM_NAMES: Record<OutfitId, string> = {
  field: "田间工装", raincoat: "防水裤与雨靴", ranger: "巡护长裤与皮靴",
};

export const outfitPreview = (avatar: AvatarId, outfit: OutfitId, bottom: OutfitId) =>
  `${import.meta.env.BASE_URL}avatars/wardrobe/${avatar}-${outfit}${bottom === outfit ? "" : "-" + bottom}.webp`;
