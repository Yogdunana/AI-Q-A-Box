import { useState } from "react";
import { Link } from "react-router";
import { m } from "motion/react";
import { AlertCircle, ArrowRight, ArrowUpRight, Check, Copy, Inbox, RefreshCw, VenetianMask } from "lucide-react";
import { api, messageFor } from "../../api";
import { Card, Page, PageHeader } from "../../components/layout/Page";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyState, Skeleton, StatusBadge } from "../../components/ui/Display";
import { Switch } from "../../components/ui/Switch";
import { boxUrl, displayHost, greeting, relativeTime, todayLabel } from "../../lib/format";
import { useCopy } from "../../lib/hooks";
import { fadeUp, stagger } from "../../lib/motion";
import { useQuery } from "../../lib/query";
import { countFor, INBOX_VIEW_BY_ID, type InboxView } from "../../lib/status";
import { useOwner, useSession } from "../../state/session";
import { useToast } from "../../state/toast";
import styles from "./OverviewPage.module.css";

const STATS: Array<{ view: InboxView; label: string }> = [
  { view: "new", label: "新问题" },
  { view: "pending", label: "待处理" },
  { view: "drafted", label: "有草稿" },
  { view: "answered", label: "已回复" },
];

export function OverviewPage() {
  const { user, box } = useOwner();
  const pending = INBOX_VIEW_BY_ID.pending;
  const { data, error, loading, refetch } = useQuery("questions:list:pending:", () =>
    api.listQuestions({ status: pending.statuses }),
  );
  const counts = data?.counts ?? {};
  const newCount = counts.submitted ?? 0;
  const pendingCount = countFor(pending, counts);
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  const summary = loading
    ? " "
    : newCount > 0
      ? `有 ${newCount} 个新问题在等你。`
      : pendingCount > 0
        ? `还有 ${pendingCount} 个问题待处理。`
        : total > 0
          ? "收件箱已清空，享受片刻安静。"
          : "你的提问箱已经就绪，分享出去收下第一个问题吧。";

  return (
    <Page>
      <PageHeader
        eyebrow={todayLabel()}
        title={`${greeting()}，${user.display_name}`}
        description={summary}
        actions={
          <ButtonLink to="/app/inbox" variant="primary" trailingIcon={<ArrowRight />}>
            打开收件箱
          </ButtonLink>
        }
      />

      <m.div variants={stagger(0.05)} initial="initial" animate="animate">
        <m.div variants={fadeUp}>
          <Card padded={false} className={styles.stats}>
            {STATS.map((stat) => {
              const value = countFor(INBOX_VIEW_BY_ID[stat.view], counts);
              return (
                <Link
                  key={stat.view}
                  to={stat.view === "pending" ? "/app/inbox" : `/app/inbox?view=${stat.view}`}
                  className={styles.stat}
                >
                  <span className={styles.statLabel}>{stat.label}</span>
                  {loading ? (
                    <Skeleton width={40} height={30} />
                  ) : (
                    <span className={styles.statValue} data-highlight={stat.view === "new" && value > 0 || undefined}>
                      {value}
                    </span>
                  )}
                </Link>
              );
            })}
          </Card>
        </m.div>

        <div className={styles.columns}>
          <m.section variants={fadeUp} className={styles.queue} aria-labelledby="queue-title">
            <div className={styles.sectionHead}>
              <h2 id="queue-title" className={styles.sectionTitle}>
                待处理
              </h2>
              {pendingCount > 5 && (
                <Link to="/app/inbox" className={styles.more}>
                  查看全部 {pendingCount} 个
                  <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>
            <Card padded={false} className={styles.queueCard}>
              {loading ? (
                <div className={styles.queueSkeleton}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={styles.queueSkeletonRow}>
                      <Skeleton width="86%" height={14} />
                      <Skeleton width={120} height={11} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <EmptyState
                  compact
                  icon={<AlertCircle />}
                  tone="danger"
                  title="没能加载待处理的问题"
                  body={messageFor(error)}
                  actions={
                    <Button variant="secondary" size="sm" leadingIcon={<RefreshCw />} onClick={() => void refetch()}>
                      重试
                    </Button>
                  }
                />
              ) : data && data.items.length > 0 ? (
                <ul>
                  {data.items.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <Link to={`/app/questions/${q.id}`} state={{ from: "/app" }} className={styles.queueRow}>
                        <span className={styles.queueText} data-unread={q.status === "submitted" || undefined}>
                          {q.content}
                        </span>
                        <span className={styles.queueMeta}>
                          <StatusBadge status={q.status} />
                          <span className={styles.queueAsker}>
                            {q.is_anonymous ? (
                              <>
                                <VenetianMask aria-hidden="true" />
                                匿名
                              </>
                            ) : (
                              q.asker_display_name
                            )}
                          </span>
                          <span>·</span>
                          <time dateTime={q.submitted_at}>{relativeTime(q.submitted_at)}</time>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={total > 0 ? <Check /> : <Inbox />}
                  title={total > 0 ? "全部处理完了" : "还没有收到问题"}
                  body={total > 0 ? "新问题到达时会出现在这里。" : "复制右侧的链接，分享到你常出现的地方。"}
                />
              )}
            </Card>
          </m.section>

          <m.aside variants={fadeUp} className={styles.side} aria-label="提问箱">
            <ShareCard slug={box.slug} />
            <AcceptingCard />
          </m.aside>
        </div>
      </m.div>
    </Page>
  );
}

function ShareCard({ slug }: { slug: string }) {
  const { copied, copy } = useCopy();
  const toast = useToast();
  return (
    <Card className={styles.shareCard}>
      <p className={styles.cardLabel}>你的链接</p>
      <p className={styles.shareUrl}>
        <span>{displayHost()}/</span>
        <strong>{slug}</strong>
      </p>
      <div className={styles.shareActions}>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={copied ? <Check /> : <Copy />}
          onClick={async () => {
            if (await copy(boxUrl(slug))) toast.success("链接已复制");
          }}
        >
          {copied ? "已复制" : "复制链接"}
        </Button>
        <ButtonLink to="/app/share" variant="ghost" size="sm" trailingIcon={<ArrowUpRight />}>
          更多分享方式
        </ButtonLink>
      </div>
    </Card>
  );
}

function AcceptingCard() {
  const { box } = useOwner();
  const { setBox } = useSession();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const accepting = box.status === "active";

  async function toggle(next: boolean) {
    setPending(true);
    try {
      const updated = await api.updateBox(box.id, { status: next ? "active" : "paused" });
      setBox(updated);
      toast.success(next ? "已恢复接收新问题" : "已暂停接收新问题");
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <Switch
        checked={accepting}
        onChange={toggle}
        disabled={pending}
        label="接收新问题"
        description={accepting ? "访客现在可以向你提问。" : "提问箱已暂停，访客会看到暂停提示。"}
      />
    </Card>
  );
}
