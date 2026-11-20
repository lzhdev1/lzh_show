export const DECOR_STYLES = [
  { id: "orchard", name: "青藤原木", colors: ["#668b72", "#d8bb89", "#ecf6a4"] },
  { id: "lantern", name: "琥珀灯市", colors: ["#a9463d", "#e4ad64", "#ffe293"] },
  { id: "moon", name: "星月瓷蓝", colors: ["#465677", "#a3b6d2", "#a4eeff"] },
] as const;

export type DecorStyle = typeof DECOR_STYLES[number]["id"];
export interface FarmDecor {
  fence: DecorStyle;
  gate: DecorStyle;
  sign: DecorStyle;
  lettering: DecorStyle;
  text: string;
}

export const DEFAULT_DECOR: FarmDecor = {
  fence: "orchard", gate: "orchard", sign: "orchard", lettering: "orchard", text: "TT农场",
};

export function normalizeDecor(raw: unknown): FarmDecor {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const style = (x: unknown): DecorStyle => DECOR_STYLES.find(row => row.id === x)?.id ?? "orchard";
  const text = typeof data.text === "string"
    ? Array.from(data.text.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/gu, "").trim()).slice(0, 12).join("")
    : "";
  return { fence: style(data.fence), gate: style(data.gate), sign: style(data.sign),
    lettering: style(data.lettering), text: text || DEFAULT_DECOR.text };
}
