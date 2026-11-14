import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Flag,
  Inbox as InboxIcon,
  MousePointerClick,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  VenetianMask,
  X,
} from "lucide-react";
import { api, messageFor, type Question, type StatusCounts } from "../../api";
import { Button, ButtonLink, IconButton } from "../../components/ui/Button";
import { EmptyState, Kbd, Skeleton, StatusBadge } from "../../components/ui/Display";
import { Input } from "../../components/ui/Field";
import { Menu, MenuItem } from "../../components/ui/Menu";
import { boxUrl, relativeTime } from "../../lib/format";
import { useBreakpoint, useCopy, useDebouncedValue, isTypingTarget } from "../../lib/hooks";
import { duration, ease, spring } from "../../lib/motion";
import { useQuery } from "../../lib/query";
import { countFor, INBOX_VIEW_BY_ID, INBOX_VIEWS, isInboxView, type InboxView, type InboxViewMeta } from "../../lib/status";
import { useOwner } from "../../state/session";
import { useToast } from "../../state/toast";
import { QuestionDetail } from "../question/QuestionDetail";
import styles from "./InboxPage.module.css";

export function InboxPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { lg, xl } = useBreakpoint();
  const viewParam = params.get("view");
  const view: InboxView = isInboxView(viewParam) ? viewParam : "pending";
  const meta = INBOX_VIEW_BY_ID[view];
  const selected = params.get("selected");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebouncedValue(search.trim(), 250);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, error, loading, refetch } = useQuery(`questions:list:${view}:${q}`, () =>
    api.listQuestions({ status: meta.statuses, q: q || undefined }),
  );
  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = data?.counts ?? {};

  const update = useCallback(
    (next: Record<string, string | null>, replace = true) => {
      setParams(
        (current) => {
          const p = new URLSearchParams(current);
          for (const [k, v] of Object.entries(next)) {
            if (v === null || v === "") p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) update({ q: q || null });
  }, [q, params, update]);

  // Only fill an empty selection: a question that just left this view (e.g. after
  // replying) stays open so the owner sees the result of what they did.
  useEffect(() => {
    if (!lg || loading || selected || items.length === 0) return;
    update({ selected: items[0].id });
  }, [lg, loading, items, selected, update]);

  const open = useCallback(
    (question: Question) => {
      if (lg) update({ selected: question.id });
      else navigate(`/app/questions/${question.id}`, { state: { from: `/app/inbox?${params.toString()}` } });
    },
    [lg, update, navigate, params],
  );

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      const index = items.findIndex((item) => item.id === selected);
      const next = items[Math.min(items.length - 1, Math.max(0, (index === -1 ? -1 : index) + delta))];
      if (!next) return;
      if (lg) update({ selected: next.id });
      listRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
    },
    [items, selected, lg, update],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === "j" || (event.key === "ArrowDown" && listRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        move(1);
      } else if (event.key === "k" || (event.key === "ArrowUp" && listRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        move(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const onRemoved = useCallback(() => {
    const index = items.findIndex((item) => item.id === selected);
    const neighbor = items[index + 1] ?? items[index - 1];
    update({ selected: neighbor?.id ?? null });
  }, [items, selected, update]);

  const setView = (next: InboxView) => update({ view: next === "pending" ? null : next, selected: null });

  const totalQuestions = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <div className={styles.inbox}>
      {xl && <ViewRail view={view} counts={counts} onChange={setView} />}

      <section className={styles.listPane} aria-label="问题列表">
        <header className={styles.listHeader}>
          <div className={styles.listTitleRow}>
            {xl ? (
              <h1 className={styles.listTitle}>{meta.label}</h1>
            ) : (
              <ViewSwitcher view={view} counts={counts} onChange={setView} />
            )}
            {data && <span className={styles.listCount}>{data.total}</span>}
          </div>
          <div className={styles.search}>
            <Input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="搜索问题或称呼"
              aria-label="搜索问题"
              leading={<Search />}
              trailing={
                search ? (
                  <IconButton size="sm" label="清除搜索" onClick={() => setSearch("")}>
                    <X />
                  </IconButton>
                ) : lg ? (
                  <span className={styles.searchKbd}>
                    <Kbd>/</Kbd>
                  </span>
                ) : undefined
              }
              className={styles.searchInput}
            />
          </div>
          {!xl && <ViewChips view={view} counts={counts} onChange={setView} />}
        </header>

        <div ref={listRef} className={styles.listScroll}>
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <EmptyState
              compact
              icon={<AlertCircle />}
              tone="danger"
              title="收件箱没能加载出来"
              body={messageFor(error)}
              actions={
                <Button variant="secondary" size="sm" leadingIcon={<RefreshCw />} onClick={() => void refetch()}>
                  重试
                </Button>
              }
            />
          ) : items.length === 0 ? (
            q ? (
              <EmptyState
                compact
                icon={<SearchX />}
                title="没有找到相关问题"
                body={`在“${meta.label}”里没有包含“${q}”的问题。`}
                actions={
                  <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                    清除搜索
                  </Button>
                }
              />
            ) : view === "pending" && totalQuestions === 0 ? (
              <FirstQuestionEmpty />
            ) : (
              <EmptyState compact icon={view === "pending" ? <Check /> : <InboxIcon />} title={meta.emptyTitle} body={meta.emptyBody} />
            )
          ) : (
            <ul className={styles.list}>
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <QuestionRow
                    key={item.id}
                    question={item}
                    selected={lg && item.id === selected}
                    onOpen={open}
                    asLink={!lg}
                    search={q}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </section>

      {lg && (
        <section className={styles.detailPane} aria-label="问题详情">
          {selected ? (
            <QuestionDetail key={selected} id={selected} variant="pane" onRemoved={onRemoved} />
          ) : (
            <div className={styles.detailEmpty}>
              {!loading && (
                <EmptyState
                  icon={<MousePointerClick />}
                  title={items.length ? "选择一个问题开始处理" : "这里暂时没有需要处理的"}
                  body={
                    items.length ? (
                      <span className={styles.kbdHint}>
                        用 <Kbd>J</Kbd> <Kbd>K</Kbd> 上下切换问题
                      </span>
                    ) : (
                      "切换左侧的分类，看看其他问题。"
                    )
                  }
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ViewRail({ view, counts, onChange }: { view: InboxView; counts: StatusCounts; onChange(v: InboxView): void }) {
  return (
    <nav className={styles.rail} aria-label="收件箱分类">
      <p className={styles.railTitle}>收件箱</p>
      <LayoutGroup id="inbox-rail">
        <ul className={styles.railList}>
          {INBOX_VIEWS.map((v) => {
            const active = v.id === view;
            const count = countFor(v, counts);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  className={styles.railItem}
                  data-active={active || undefined}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onChange(v.id)}
                >
                  {active && <m.span layoutId="rail-active" className={styles.railActive} transition={spring.snappy} />}
                  <span className={styles.railLabel}>{v.label}</span>
                  {count > 0 && <span className={styles.railCount}>{count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

function ViewSwitcher({ view, counts, onChange }: { view: InboxView; counts: StatusCounts; onChange(v: InboxView): void }) {
  const meta = INBOX_VIEW_BY_ID[view];
  return (
    <Menu
      label="切换分类"
      align="start"
      trigger={(props) => (
        <button type="button" className={styles.switcher} {...props}>
          <h1 className={styles.listTitle}>{meta.label}</h1>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    >
      {INBOX_VIEWS.map((v) => (
        <MenuItem key={v.id} onSelect={() => onChange(v.id)} hint={countFor(v, counts) || undefined} icon={v.id === view ? <Check /> : <span />}>
          {v.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

const CHIP_VIEWS: InboxView[] = ["pending", "new", "drafted", "flagged", "answered"];

function ViewChips({ view, counts, onChange }: { view: InboxView; counts: StatusCounts; onChange(v: InboxView): void }) {
  return (
    <LayoutGroup id="inbox-chips">
      <div className={styles.chips} role="tablist" aria-label="快速筛选">
        {CHIP_VIEWS.map((id) => {
          const v: InboxViewMeta = INBOX_VIEW_BY_ID[id];
          const active = id === view;
          const count = countFor(v, counts);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={styles.chip}
              data-active={active || undefined}
              onClick={() => onChange(id)}
            >
              {active && <m.span layoutId="chip-active" className={styles.chipActive} transition={spring.snappy} />}
              <span className={styles.chipLabel}>
                {v.label}
                {count > 0 && <span className={styles.chipCount}>{count}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function highlight(text: string, needle: string) {
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className={styles.mark}>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function QuestionRow({
  question,
  selected,
  onOpen,
  asLink,
  search,
}: {
  question: Question;
  selected: boolean;
  onOpen(q: Question): void;
  asLink: boolean;
  search: string;
}) {
  const unread = question.status === "submitted";
  const content = (
    <>
      {selected && <m.span layoutId="row-selected" className={styles.rowSelected} transition={spring.snappy} />}
      <span className={styles.rowTop}>
        {unread && <span className={styles.unreadDot} aria-label="未读" />}
        <span className={styles.rowAsker}>
          {question.is_anonymous ? (
            <>
              <VenetianMask aria-hidden="true" />
              匿名
            </>
          ) : (
            question.asker_display_name
          )}
        </span>
        <time className={styles.rowTime} dateTime={question.submitted_at}>
          {relativeTime(question.submitted_at)}
        </time>
      </span>
      <span className={styles.rowText}>{highlight(question.content, search)}</span>
      <span className={styles.rowBottom}>
        <StatusBadge status={question.status} />
        {question.status === "flagged" && <Flag className={styles.rowFlag} aria-hidden="true" />}
        {question.status === "drafted" && <Sparkles className={styles.rowDraft} aria-hidden="true" />}
      </span>
    </>
  );

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto", transition: { duration: duration.base, ease: ease.out } }}
      exit={{ opacity: 0, height: 0, transition: { duration: duration.base, ease: ease.inOut } }}
      className={styles.rowItem}
    >
      {asLink ? (
        <Link
          to={`/app/questions/${question.id}`}
          state={{ from: `/app/inbox${window.location.search}` }}
          className={styles.row}
          data-id={question.id}
          data-unread={unread || undefined}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.row}
          data-id={question.id}
          data-selected={selected || undefined}
          data-unread={unread || undefined}
          aria-current={selected ? "true" : undefined}
          onClick={() => onOpen(question)}
        >
          {content}
        </button>
      )}
    </m.li>
  );
}

function ListSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="加载中">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonTop}>
            <Skeleton width={56} height={11} />
            <Skeleton width={44} height={11} />
          </div>
          <Skeleton width="94%" height={13} />
          <Skeleton width={i % 2 ? "58%" : "72%"} height={13} />
        </div>
      ))}
    </div>
  );
}

function FirstQuestionEmpty() {
  const { box } = useOwner();
  const { copied, copy } = useCopy();
  const toast = useToast();
  return (
    <EmptyState
      icon={<InboxIcon />}
      title="还没有收到问题"
      body="把链接分享到个人主页、社交媒体或群聊里，第一个问题很快就会来。"
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={copied ? <Check /> : <Copy />}
            onClick={async () => {
              if (await copy(boxUrl(box.slug))) toast.success("链接已复制");
            }}
          >
            {copied ? "已复制" : "复制链接"}
          </Button>
          <ButtonLink to="/app/share" variant="secondary" size="sm">
            分享设置
          </ButtonLink>
        </>
      }
    />
  );
}
