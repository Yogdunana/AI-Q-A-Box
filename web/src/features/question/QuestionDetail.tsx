import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Ban,
  Flag,
  Inbox,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
  VenetianMask,
} from "lucide-react";
import { isApiError, messageFor, type QuestionDetail as Detail } from "../../api";
import { BackButton } from "../../components/ui/BackButton";
import { Button, IconButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { EmptyState, Skeleton, StatusBadge } from "../../components/ui/Display";
import { Menu, MenuItem, MenuSeparator } from "../../components/ui/Menu";
import { fullTime, relativeTime } from "../../lib/format";
import { fadeUp, stagger } from "../../lib/motion";
import { AiDraftPanel } from "./AiDraftPanel";
import { AnswerComposer, type AnswerComposerHandle } from "./AnswerComposer";
import { useQuestionActions, useQuestionDetail } from "./useQuestionActions";
import styles from "./QuestionDetail.module.css";

interface QuestionDetailProps {
  id: string;
  variant: "pane" | "page";
  onBack?(): void;
  backLabel?: string;
  /** Called after the question leaves the current list (archived, spam, deleted). */
  onRemoved?(): void;
}

export function QuestionDetail({ id, variant, onBack, backLabel = "收件箱", onRemoved }: QuestionDetailProps) {
  const { data, error, loading, refetch } = useQuestionDetail(id);

  if (loading) return <DetailSkeleton variant={variant} onBack={onBack} backLabel={backLabel} />;
  if (error || !data) {
    return (
      <div className={styles.state}>
        {isApiError(error, "not_found") ? (
          <EmptyState
            icon={<Inbox />}
            title="这个问题不存在"
            body="它可能已经被删除了。"
            actions={
              onBack && (
                <Button variant="secondary" onClick={onBack}>
                  返回{backLabel}
                </Button>
              )
            }
          />
        ) : (
          <EmptyState
            icon={<AlertCircle />}
            tone="danger"
            title="加载失败"
            body={messageFor(error)}
            actions={
              <Button variant="primary" leadingIcon={<RefreshCw />} onClick={() => void refetch()}>
                重试
              </Button>
            }
          />
        )}
      </div>
    );
  }
  return <DetailView detail={data} variant={variant} onBack={onBack} backLabel={backLabel} onRemoved={onRemoved} />;
}

function DetailView({ detail, variant, onBack, backLabel = "收件箱", onRemoved }: { detail: Detail } & Omit<QuestionDetailProps, "id">) {
  const { question } = detail;
  const { setStatus, restore, remove } = useQuestionActions();
  const composerRef = useRef<AnswerComposerHandle>(null);
  const [confirm, setConfirm] = useState<"spam" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const markedRef = useRef(false);

  useEffect(() => {
    if (question.status === "submitted" && !markedRef.current) {
      markedRef.current = true;
      void setStatus(question, "reviewing", { silent: true });
    }
  }, [question, setStatus]);

  const status = question.status;
  const spam = status === "spam";
  const archived = status === "archived";
  const flagged = status === "flagged";

  async function archiveToggle() {
    if (archived) {
      await restore(detail);
      return;
    }
    const ok = await setStatus(question, "archived", { undoable: true });
    if (ok) onRemoved?.();
  }

  async function flagToggle() {
    if (flagged) await restore(detail, "已取消需留意标记");
    else await setStatus(question, "flagged", { undoable: true });
  }

  async function confirmAction() {
    setBusy(true);
    const ok = confirm === "delete" ? await remove(question) : await setStatus(question, "spam", { undoable: true });
    setBusy(false);
    setConfirm(null);
    if (ok) onRemoved?.();
  }

  return (
    <article className={styles.detail} data-variant={variant} aria-label="问题详情">
      <div className={styles.toolbar}>
        {onBack && <BackButton label={backLabel} onClick={onBack} />}
        <StatusBadge status={status} />
        <div className={styles.toolbarActions}>
          {!spam && (
            <IconButton label={flagged ? "取消需留意" : "标记为需留意"} aria-pressed={flagged} onClick={flagToggle}>
              <Flag />
            </IconButton>
          )}
          <IconButton label={archived ? "移回收件箱" : "归档"} onClick={archiveToggle}>
            {archived ? <ArchiveRestore /> : <Archive />}
          </IconButton>
          <Menu
            label="更多操作"
            trigger={(props) => (
              <IconButton label="更多操作" {...props}>
                <MoreHorizontal />
              </IconButton>
            )}
          >
            {spam ? (
              <MenuItem icon={<Inbox />} onSelect={() => void restore(detail)}>
                不是垃圾，移回收件箱
              </MenuItem>
            ) : (
              <MenuItem icon={<Ban />} onSelect={() => setConfirm("spam")}>
                标记为垃圾
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => setConfirm("delete")}>
              删除问题
            </MenuItem>
          </Menu>
        </div>
      </div>

      <div className={styles.scroll}>
        <m.div className={styles.inner} variants={stagger(0.05)} initial="initial" animate="animate">
          <m.header className={styles.meta} variants={fadeUp}>
            <span className={styles.asker}>
              {question.is_anonymous ? <VenetianMask aria-hidden="true" /> : <UserRound aria-hidden="true" />}
              {question.is_anonymous ? "匿名提问者" : question.asker_display_name}
            </span>
            <span className={styles.metaDot} aria-hidden="true" />
            <time dateTime={question.submitted_at} title={fullTime(question.submitted_at)}>
              {relativeTime(question.submitted_at)}
            </time>
          </m.header>

          <m.p className={styles.question} variants={fadeUp}>
            {question.content}
          </m.p>

          {flagged && (
            <m.div className={styles.risk} variants={fadeUp} role="note">
              <ShieldAlert aria-hidden="true" />
              <p>已标记为需留意。回复前请仔细核对；涉及敏感话题时，不要直接采用 AI 草稿。</p>
            </m.div>
          )}

          {spam && (
            <m.div className={styles.risk} data-tone="muted" variants={fadeUp} role="note">
              <Ban aria-hidden="true" />
              <p>这个问题被标记为垃圾，移回收件箱后才能回复。</p>
            </m.div>
          )}

          <m.div variants={fadeUp} className={styles.block}>
            <AiDraftPanel detail={detail} locked={spam} onAdopt={(text) => composerRef.current?.adopt(text)} />
          </m.div>

          <m.div variants={fadeUp} className={styles.block}>
            <AnswerComposer ref={composerRef} key={question.id} detail={detail} locked={spam} />
          </m.div>

          <m.div variants={fadeUp} className={styles.block}>
            <Timeline detail={detail} />
          </m.div>
        </m.div>
      </div>

      <ConfirmDialog
        open={confirm === "spam"}
        title="标记为垃圾？"
        description="它会被移出收件箱，放进“垃圾”里。之后可以随时移回来。"
        confirmLabel="标记为垃圾"
        variant="danger"
        loading={busy}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="删除这个问题？"
        description="删除后，问题、草稿和回复都不会再出现在你的收件箱里。"
        confirmLabel="删除"
        variant="danger"
        loading={busy}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </article>
  );
}

function Timeline({ detail }: { detail: Detail }) {
  const { question, answer, generations } = detail;
  const events: Array<{ at: string; label: string }> = [{ at: question.submitted_at, label: "收到问题" }];
  generations.forEach((g, i) => events.push({ at: g.created_at, label: `生成 AI 草稿 · 第 ${i + 1} 版` }));
  if (answer) {
    if (answer.published_at) events.push({ at: answer.published_at, label: "公开发布回复" });
    else if (answer.sent_at) events.push({ at: answer.sent_at, label: "私密回复" });
    else events.push({ at: answer.updated_at, label: "保存回复草稿" });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section aria-labelledby="timeline-title" className={styles.timeline}>
      <h3 id="timeline-title" className={styles.timelineTitle}>
        记录
      </h3>
      <ol className={styles.timelineList}>
        {events.map((event, i) => (
          <li key={`${event.at}-${i}`} className={styles.timelineItem}>
            <span className={styles.timelineDot} aria-hidden="true" />
            <span className={styles.timelineLabel}>{event.label}</span>
            <time className={styles.timelineTime} dateTime={event.at} title={fullTime(event.at)}>
              {relativeTime(event.at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetailSkeleton({ variant, onBack, backLabel }: { variant: "pane" | "page"; onBack?(): void; backLabel: string }) {
  return (
    <div className={styles.detail} data-variant={variant} aria-busy="true" aria-label="加载中">
      <div className={styles.toolbar}>
        {onBack && <BackButton label={backLabel} onClick={onBack} />}
        <Skeleton width={64} height={22} radius={11} />
      </div>
      <div className={styles.scroll}>
        <div className={styles.inner}>
          <Skeleton width={140} height={12} />
          <Skeleton width="92%" height={22} style={{ marginTop: 20 }} />
          <Skeleton width="70%" height={22} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={120} radius={14} style={{ marginTop: 32 }} />
          <Skeleton width="100%" height={160} radius={14} style={{ marginTop: 24 }} />
        </div>
      </div>
    </div>
  );
}
