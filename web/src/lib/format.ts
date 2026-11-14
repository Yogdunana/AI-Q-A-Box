const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
const monthDayFmt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });
const fullFmt = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const yearFmt = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function relativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (dayDiff === 0) return `${Math.floor(diff / HOUR)} 小时前`;
  if (dayDiff === 1) return `昨天 ${timeFmt.format(date)}`;
  if (dayDiff < 7) return `${dayDiff} 天前`;
  if (date.getFullYear() === now.getFullYear()) return monthDayFmt.format(date);
  return yearFmt.format(date);
}

export function fullTime(iso: string): string {
  return fullFmt.format(new Date(iso));
}

export function todayLabel(now = new Date()): string {
  return weekdayFmt.format(now);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

const AVATAR_TINTS = [
  ["#f6e4dc", "#8f3a22"],
  ["#e5ebf6", "#34508f"],
  ["#e4f0e9", "#2c6447"],
  ["#f3ead9", "#7a5414"],
  ["#ece6f4", "#5a3f8a"],
  ["#e2eff0", "#1f6266"],
] as const;

export function avatarTint(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const [bg, fg] = AVATAR_TINTS[hash % AVATAR_TINTS.length];
  return { bg, fg };
}

export function truncate(text: string, max: number): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : chars.join("");
}

/** Public URL of a box. Uses the current origin so links work on any deployment. */
export function boxUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/${slug}`;
}

export function displayHost(): string {
  return typeof window === "undefined" ? "" : window.location.host;
}
