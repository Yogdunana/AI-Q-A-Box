import { useEffect, useState, type ComponentType } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import {
  Check,
  Copy,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Send,
  Settings2,
  type LucideProps,
} from "lucide-react";
import { api } from "../../api";
import { effectiveLevel, useRouteMeta } from "../../app/routeMeta";
import { useInboxCounts } from "../../features/owner/useInboxCounts";
import { boxUrl, displayHost } from "../../lib/format";
import { useCopy, useLayout } from "../../lib/hooks";
import { duration, ease, spring, type PageTransition } from "../../lib/motion";
import { useOwner, useSession } from "../../state/session";
import { useToast } from "../../state/toast";
import { BrandName } from "../brand/Brand";
import { Avatar } from "../ui/Display";
import { IconButton } from "../ui/Button";
import { Menu, MenuItem, MenuLink, MenuSeparator } from "../ui/Menu";
import { AnimatedOutlet } from "./AnimatedOutlet";
import styles from "./AppShell.module.css";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  match: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "概览", icon: LayoutDashboard, match: (p) => p === "/app" },
  {
    to: "/app/inbox",
    label: "收件箱",
    icon: Inbox,
    match: (p) => p.startsWith("/app/inbox") || p.startsWith("/app/questions"),
  },
  { to: "/app/share", label: "分享", icon: Send, match: (p) => p.startsWith("/app/share") },
  { to: "/app/settings", label: "设置", icon: Settings2, match: (p) => p.startsWith("/app/settings") },
];

/** Infer the transition from how the navigation level changed. */
function usePageTransition(level: 1 | 2, desktop: boolean): PageTransition {
  const { pathname } = useLocation();
  const [previous, setPrevious] = useState({ pathname, level, transition: "page" as PageTransition });
  if (previous.pathname !== pathname) {
    const transition: PageTransition = desktop
      ? "page"
      : level > previous.level
        ? "push"
        : level < previous.level
          ? "pop"
          : "fade";
    setPrevious({ pathname, level, transition });
    return transition;
  }
  return previous.transition;
}

export function AppShell() {
  const { pathname } = useLocation();
  const { counts } = useInboxCounts();
  const newCount = counts.submitted ?? 0;
  const layout = useLayout();
  const meta = useRouteMeta();
  const level = effectiveLevel(meta, layout.split);
  const transition = usePageTransition(level, layout.desktop);

  // Settings sections share one key when shown side by side so only the form area swaps.
  const keyFor = (path: string) => (layout.split && path.startsWith("/app/settings") ? "/app/settings" : path);

  return (
    <div className={styles.shell} data-app-shell="" data-level={level}>
      <a href="#main" className="skip-link">
        跳到主要内容
      </a>
      <Sidebar pathname={pathname} newCount={newCount} />
      {level === 1 && <TouchTopBar title={meta.title} />}
      <main id="main" className={styles.main} tabIndex={-1}>
        <AnimatedOutlet className={styles.page} keyFor={keyFor} transition={transition} />
      </main>
      <AnimatePresence initial={false}>
        {level === 1 && <TabBar key="tabbar" pathname={pathname} newCount={newCount} />}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ pathname, newCount }: { pathname: string; newCount: number }) {
  const { box } = useOwner();
  return (
    <aside className={styles.sidebar} aria-label="主导航" data-testid="nav-sidebar" data-mode="sidebar">
      <div className={styles.sidebarTop}>
        <BrandName to="/app" />
      </div>
      <LayoutGroup id="sidebar-nav">
        <nav>
          <ul className={styles.navList}>
            {NAV.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              const badge = item.to === "/app/inbox" && newCount > 0 ? newCount : null;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/app"}
                    className={styles.navItem}
                    data-active={active || undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <m.span layoutId="nav-active" className={styles.navActive} transition={spring.snappy} />}
                    <Icon className={styles.navIcon} aria-hidden="true" />
                    <span className={styles.navLabel}>{item.label}</span>
                    {badge !== null && (
                      <span className={styles.navBadge} aria-label={`${badge} 个新问题`}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </LayoutGroup>

      <div className={styles.sidebarBottom}>
        <BoxLinkCard slug={box.slug} />
        {api.mode === "mock" && (
          <p className={styles.demoNote}>
            <span className={styles.demoDot} aria-hidden="true" />
            演示模式 · 数据仅保存在此浏览器
          </p>
        )}
        <UserMenu placement="top" />
      </div>
    </aside>
  );
}

function BoxLinkCard({ slug }: { slug: string }) {
  const { copied, copy } = useCopy();
  const toast = useToast();
  const url = boxUrl(slug);
  return (
    <div className={styles.linkCard}>
      <div className={styles.linkText}>
        <span className={styles.linkLabel}>你的提问箱</span>
        <span className={styles.linkUrl} title={url}>
          {displayHost()}/<strong>{slug}</strong>
        </span>
      </div>
      <div className={styles.linkActions}>
        <IconButton
          size="sm"
          label={copied ? "已复制" : "复制链接"}
          onClick={async () => {
            if (await copy(url)) toast.success("链接已复制");
          }}
        >
          {copied ? <Check /> : <Copy />}
        </IconButton>
        <a
          className={styles.linkOpen}
          href={`/${slug}`}
          target="_blank"
          rel="noreferrer"
          aria-label="在新标签页打开公开页"
          title="打开公开页"
        >
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function UserMenu({ placement, compact }: { placement: "top" | "bottom"; compact?: boolean }) {
  const { user, box } = useOwner();
  const { logout } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <Menu
      label="账户"
      placement={placement}
      align={compact ? "end" : "start"}
      width={compact ? 220 : 228}
      className={compact ? undefined : styles.userMenuRoot}
      trigger={(props) => (
        <button type="button" className={compact ? styles.userCompact : styles.userButton} aria-label="账户菜单" {...props}>
          <Avatar name={user.display_name} src={user.avatar_url} size={compact ? 30 : 28} />
          {!compact && (
            <span className={styles.userText}>
              <span className={styles.userName}>{user.display_name}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </span>
          )}
        </button>
      )}
    >
      <MenuLink to={`/${box.slug}`} icon={<ExternalLink />} external>
        查看公开页
      </MenuLink>
      <MenuLink to="/app/settings" icon={<Settings2 />}>
        设置
      </MenuLink>
      <MenuSeparator />
      <MenuItem
        icon={<LogOut />}
        onSelect={async () => {
          try {
            await logout();
            navigate("/", { replace: true });
          } catch {
            toast.error("退出失败，请重试。");
          }
        }}
      >
        退出登录
      </MenuItem>
    </Menu>
  );
}

/** Touch top bar: shows the brand at rest and the page title once the page header scrolls away. */
function TouchTopBar({ title }: { title?: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={styles.topbar} data-scrolled={scrolled || undefined}>
      <div className={styles.topbarTitle}>
        <AnimatePresence mode="wait" initial={false}>
          {scrolled && title ? (
            <m.span
              key="title"
              className={styles.topbarPageTitle}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: duration.fast, ease: ease.out }}
            >
              {title}
            </m.span>
          ) : (
            <m.span
              key="brand"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: duration.fast, ease: ease.out }}
            >
              <BrandName to="/app" />
            </m.span>
          )}
        </AnimatePresence>
      </div>
      <UserMenu placement="bottom" compact />
    </header>
  );
}

function TabBar({ pathname, newCount }: { pathname: string; newCount: number }) {
  return (
    <m.div
      className={styles.tabbarWrap}
      initial={{ y: "120%" }}
      animate={{ y: 0, transition: { duration: duration.base, ease: ease.out } }}
      exit={{ y: "120%", transition: { duration: duration.fast, ease: ease.in } }}
    >
      <LayoutGroup id="tab-nav">
        <nav className={styles.tabbar} aria-label="主导航" data-testid="nav-tabbar">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const badge = item.to === "/app/inbox" && newCount > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/app"}
                className={styles.tab}
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                {active && <m.span layoutId="tab-active" className={styles.tabActive} transition={spring.snappy} />}
                <span className={styles.tabIconWrap}>
                  <Icon className={styles.tabIcon} aria-hidden="true" />
                  {badge && <span className={styles.tabDot} aria-label={`${newCount} 个新问题`} />}
                </span>
                <span className={styles.tabLabel}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </LayoutGroup>
    </m.div>
  );
}
