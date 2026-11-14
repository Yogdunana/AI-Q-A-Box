import { useMatches } from "react-router";

/**
 * Navigation metadata attached to owner routes as `handle`.
 * - level 1: a tab destination; the touch tab bar stays visible.
 * - level 2: pushed on top of a tab; touch layouts hide the tab bar and show a back bar.
 * `collapseWhenSplit` turns a level-2 route into level 1 when the screen is wide
 * enough to show it beside its parent (e.g. settings sections on a tablet).
 */
export interface RouteMeta {
  title?: string;
  level?: 1 | 2;
  collapseWhenSplit?: boolean;
}

export function useRouteMeta(): RouteMeta {
  const matches = useMatches();
  const meta: RouteMeta = {};
  for (const match of matches) Object.assign(meta, (match.handle as RouteMeta | undefined) ?? {});
  return meta;
}

export function effectiveLevel(meta: RouteMeta, split: boolean): 1 | 2 {
  if (meta.level !== 2) return 1;
  return meta.collapseWhenSplit && split ? 1 : 2;
}
