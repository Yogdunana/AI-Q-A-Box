export type SettingsSectionId = "profile" | "box" | "style" | "account";

export const SETTINGS_SECTIONS: Array<{ id: SettingsSectionId; title: string }> = [
  { id: "profile", title: "个人资料" },
  { id: "box", title: "提问箱" },
  { id: "style", title: "AI 回复风格" },
  { id: "account", title: "账户与数据" },
];
