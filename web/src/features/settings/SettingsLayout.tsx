import type { ComponentType } from "react";
import { Link, Navigate, NavLink, useLocation, useOutlet } from "react-router";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { ChevronRight, Inbox, KeyRound, Sparkles, UserRound, type LucideProps } from "lucide-react";
import { api, type ReplyStyle } from "../../api";
import { Page, PageHeader } from "../../components/layout/Page";
import { Avatar } from "../../components/ui/Display";
import { useLayout } from "../../lib/hooks";
import { duration, ease, fadeUp, spring, stagger } from "../../lib/motion";
import { useOwner } from "../../state/session";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./meta";
import styles from "./Settings.module.css";

const SECTION_ICONS: Record<SettingsSectionId, ComponentType<LucideProps>> = {
  profile: UserRound,
  box: Inbox,
  style: Sparkles,
  account: KeyRound,
};

const TONE_LABEL: Record<ReplyStyle["tone"], string> = { warm: "温和", direct: "直接", playful: "轻松", professional: "专业" };
const LENGTH_LABEL: Record<ReplyStyle["length"], string> = { short: "简短", medium: "适中", long: "详细" };
const LANGUAGE_LABEL: Record<ReplyStyle["language"], string> = { auto: "跟随提问", zh: "中文", en: "English" };

function useSectionSummaries(): Record<SettingsSectionId, string> {
  const { user, box } = useOwner();
  const style = box.reply_style;
  return {
    profile: user.display_name,
    box: `${box.title} · ${box.status === "active" ? "接收中" : "已暂停"}`,
    style: `${TONE_LABEL[style.tone]} · ${LENGTH_LABEL[style.length]} · ${LANGUAGE_LABEL[style.language]}`,
    account: api.mode === "mock" ? "退出登录 · 演示数据" : "退出登录",
  };
}

/**
 * Settings is a two-level structure. On phones the index lists the sections and
 * each one is pushed as its own page; on tablets and desktops the list stays
 * beside the selected section.
 */
export function SettingsLayout() {
  const { split } = useLayout();
  const outlet = useOutlet();
  const { pathname } = useLocation();

  if (!split) return outlet;

  return (
    <Page className={styles.splitPage}>
      <div className={styles.split}>
        <SettingsNav />
        <div className={styles.splitContent}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: duration.instant } }}
            >
              {outlet}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}

export function SettingsIndex() {
  const { split } = useLayout();
  if (split) return <Navigate to="/app/settings/profile" replace />;
  return <SettingsHome />;
}

function SettingsNav() {
  const { pathname } = useLocation();
  return (
    <nav className={styles.nav} aria-label="设置分区">
      <h1 className={styles.navTitle}>设置</h1>
      <LayoutGroup id="settings-nav">
        <ul className={styles.navList}>
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section.id];
            const active = pathname === `/app/settings/${section.id}`;
            return (
              <li key={section.id}>
                <NavLink to={`/app/settings/${section.id}`} className={styles.navItem} data-active={active || undefined}>
                  {active && <m.span layoutId="settings-active" className={styles.navActive} transition={spring.snappy} />}
                  <Icon className={styles.navIcon} aria-hidden="true" />
                  <span className={styles.navLabel}>{section.title}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

function SettingsHome() {
  const { user } = useOwner();
  const summaries = useSectionSummaries();
  const groups: SettingsSectionId[][] = [["box", "style"], ["account"]];

  return (
    <Page width="narrow">
      <PageHeader title="设置" />
      <m.div className={styles.home} variants={stagger(0.04)} initial="initial" animate="animate">
        <m.div variants={fadeUp}>
          <Link to="/app/settings/profile" className={styles.profileCard}>
            <Avatar name={user.display_name} src={user.avatar_url} size={52} />
            <span className={styles.profileText}>
              <span className={styles.profileName}>{user.display_name}</span>
              <span className={styles.profileEmail}>{user.email}</span>
            </span>
            <ChevronRight className={styles.chevron} aria-hidden="true" />
          </Link>
        </m.div>

        {groups.map((group) => (
          <m.ul key={group.join("-")} className={styles.group} variants={fadeUp}>
            {group.map((id) => {
              const section = SETTINGS_SECTIONS.find((s) => s.id === id)!;
              const Icon = SECTION_ICONS[id];
              return (
                <li key={id}>
                  <Link to={`/app/settings/${id}`} className={styles.row}>
                    <span className={styles.rowIcon} data-section={id} aria-hidden="true">
                      <Icon />
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{section.title}</span>
                      <span className={styles.rowSummary}>{summaries[id]}</span>
                    </span>
                    <ChevronRight className={styles.chevron} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </m.ul>
        ))}
      </m.div>
    </Page>
  );
}
