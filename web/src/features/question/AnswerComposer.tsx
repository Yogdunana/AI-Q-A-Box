import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { useBlocker } from "react-router";
import { AnimatePresence, m, useAnimate } from "motion/react";
import { Check, Globe, Lock, PencilLine, Sparkles } from "lucide-react";
import { api, messageFor, type Answer, type QuestionDetail, type ReplyVisibility } from "../../api";
import { Avatar } from "../../components/ui/Display";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog, Dialog } from "../../components/ui/Dialog";
import { Counter, Textarea } from "../../components/ui/Field";
import { SegmentedControl } from "../../components/ui/Switch";
import { clearOwnerDraft, readOwnerDraft, writeOwnerDraft } from "../../lib/owner-draft";
import { fullTime, relativeTime, truncate } from "../../lib/format";
import { useBeforeUnload } from "../../lib/hooks";
import { fadeUp } from "../../lib/motion";
import { invalidate, setQueryData, useQuery } from "../../lib/query";
import { ANSWER_MAX } from "../../lib/validation";
import { useOwner } from "../../state/session";
import { useToast } from "../../state/toast";
import { detailKey } from "./useQuestionActions";
import styles from "./AnswerComposer.module.css";

export interface AnswerComposerHandle {
  /** Put an AI draft into the editor, asking first if it would overwrite the owner's text. */
  adopt(text: string): void;
}

interface AnswerComposerProps {
  detail: QuestionDetail;
  locked?: boolean;
  ref?: Ref<AnswerComposerHandle>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function confirmed(answer: Answer | null): boolean {
  return Boolean(answer && (answer.confirmed_at || answer.sent_at || answer.published_at));
}

export function AnswerComposer({ detail, locked, ref }: AnswerComposerProps) {
  const { box, user } = useOwner();
  const toast = useToast();
  const { question, answer } = detail;
  const capabilities = useQuery("capabilities", () => api.getCapabilities());
  const canPublic = Boolean(capabilities.data?.public_replies_enabled && question.public_consent);
  const stored = readOwnerDraft(user.id, question.id);
  const serverText = answer?.content ?? "";
  const restored =
    stored && stored.content !== serverText && stored.revision >= (answer?.draft_revision ?? 0) ? stored : null;

  const [editing, setEditing] = useState(!confirmed(answer) || Boolean(restored));
  const [content, setContent] = useState(restored?.content ?? serverText);
  const [visibility, setVisibility] = useState<ReplyVisibility>(
    canPublic ? (restored?.visibility ?? answer?.visibility ?? box.default_reply_visibility) : "private",
  );
  const [source, setSource] = useState<Answer["source"]>(restored?.source ?? answer?.source ?? "human");
  const [pending, setPending] = useState<"deliver" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replace, setReplace] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef(answer);
  const contentRef = useRef(content);
  const visibilityRef = useRef(visibility);
  const sourceRef = useRef(source);
  const revision = useRef(restored?.revision ?? answer?.draft_revision ?? 0);
  const [ackedText, setAckedText] = useState(serverText);
  const acked = useRef(serverText);
  const queue = useRef(Promise.resolve(true));
  const questionId = question.id;
  const skipBlock = useRef(false);

  const trimmed = content.trim();
  const effectiveVisibility: ReplyVisibility = canPublic ? visibility : "private";
  const dirty = trimmed !== ackedText || (answer ? effectiveVisibility !== answer.visibility && canPublic : false);
  const unsafe = !locked && (saveState === "saving" || saveState === "error" || (dirty && trimmed.length > 0));
  useBeforeUnload(unsafe);

  useEffect(() => {
    answerRef.current = answer;
    contentRef.current = content;
    visibilityRef.current = effectiveVisibility;
    sourceRef.current = source;
  });

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipBlock.current || !unsafe) return false;
    return currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search;
  });

  useEffect(() => {
    if (!trimmed || trimmed === acked.current) {
      clearOwnerDraft(user.id, questionId);
      return;
    }
    writeOwnerDraft(user.id, questionId, {
      content,
      visibility: visibilityRef.current,
      source,
      revision: revision.current,
    });
  }, [content, visibility, source, trimmed, user.id, questionId]);

  function applyDraft(text: string) {
    setEditing(true);
    setContent(text);
    setSource("ai_assisted");
    setReplace(null);
    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scope.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      textareaRef.current?.focus({ preventScroll: true });
      if (scope.current && !reduced) {
        void animate(
          scope.current,
          { boxShadow: ["0 0 0 4px rgba(75,85,184,0.28)", "0 0 0 0px rgba(75,85,184,0)"] },
          { duration: 0.9, ease: "easeOut" },
        );
      }
    });
    toast.info("草稿已放进回复框，修改后再确认");
  }

  useImperativeHandle(ref, () => ({
    adopt(text: string) {
      if (content.trim() && content.trim() !== text.trim()) setReplace(text);
      else applyDraft(text);
    },
  }));

  function writeAnswer(next: Answer, status?: QuestionDetail["question"]["status"]) {
    answerRef.current = next;
    setQueryData<QuestionDetail>(detailKey(questionId), (current) =>
      current
        ? { ...current, answer: next, question: status ? { ...current.question, status } : current.question }
        : current,
    );
    invalidate("questions:list:", "questions:counts", "public:answers:");
  }

  function flush(): Promise<boolean> {
    const run = queue.current.then(() => saveCurrent(), () => saveCurrent());
    queue.current = run.then(
      () => true,
      () => false,
    );
    return run;
  }

  async function saveCurrent(): Promise<boolean> {
    const text = contentRef.current.trim();
    const nextVisibility = visibilityRef.current;
    if (!text || text.length > ANSWER_MAX) return false;
    if (text === acked.current && answerRef.current?.visibility === nextVisibility) return true;
    const nextRevision = revision.current + 1;
    revision.current = nextRevision;
    setSaveState("saving");
    try {
      const input = {
        content: text,
        visibility: nextVisibility,
        source: sourceRef.current,
        draft_revision: nextRevision,
      };
      const current = answerRef.current;
      const next = current ? await api.updateAnswer(current.id, input) : await api.saveAnswer(questionId, input);
      revision.current = Math.max(revision.current, next.draft_revision);
      if (next.draft_revision < nextRevision && next.content !== text) {
        setSaveState("idle");
        return contentRef.current.trim() === next.content;
      }
      acked.current = next.content;
      setAckedText(next.content);
      writeAnswer(
        next,
        question.status === "submitted" || question.status === "reviewing" ? "drafted" : question.status,
      );
      if (contentRef.current.trim() === next.content) {
        setSaveState("saved");
        clearOwnerDraft(user.id, questionId);
        return true;
      }
      setSaveState("idle");
      return false;
    } catch (error) {
      setSaveState("error");
      toast.error(messageFor(error));
      return false;
    }
  }

  useEffect(() => {
    if (locked || !trimmed || trimmed.length > ANSWER_MAX || trimmed === ackedText) return;
    const timer = window.setTimeout(() => {
      void flush();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [ackedText, locked, questionId, source, trimmed, visibility]);

  async function deliver() {
    setPending("deliver");
    try {
      const saved = await flush();
      const current = answerRef.current;
      if (!saved || !current) return;
      const delivered = await api.publishAnswer(current.id, visibilityRef.current, current.draft_revision);
      acked.current = delivered.content;
      setAckedText(delivered.content);
      revision.current = delivered.draft_revision;
      clearOwnerDraft(user.id, questionId);
      writeAnswer(delivered, visibilityRef.current === "public" ? "published" : "answered_private");
      setContent(delivered.content);
      setConfirmOpen(false);
      setEditing(false);
      setSaveState("saved");
      toast.success(visibilityRef.current === "public" ? "回复已公开发布" : "回复已确认，提问者可以用查看链接看到");
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setPending(null);
    }
  }

  function requestDeliver() {
    if (!trimmed || content.length > ANSWER_MAX) {
      textareaRef.current?.focus();
      return;
    }
    setConfirmOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      requestDeliver();
    }
  }

  async function saveAndLeave() {
    const ok = await flush();
    if (!ok) return;
    skipBlock.current = true;
    blocker.proceed?.();
  }

  function discardAndLeave() {
    clearOwnerDraft(user.id, questionId);
    skipBlock.current = true;
    blocker.proceed?.();
  }

  const tooLong = content.length > ANSWER_MAX;
  const deliveredBefore = confirmed(answer);
  const snapshot = answer?.confirmed_content;
  const saveLabel = saveState === "saving" ? "保存中" : saveState === "error" ? "保存失败" : saveState === "saved" && !dirty ? "已保存" : dirty ? "未保存" : "";

  return (
    <section className={styles.section} aria-labelledby="answer-title">
      <AnimatePresence mode="wait" initial={false}>
        {!editing && deliveredBefore && answer ? (
          <m.div key="delivered" variants={fadeUp} initial="initial" animate="animate" exit={{ opacity: 0 }}>
            <div className={styles.sectionHead}>
              <h3 id="answer-title" className={styles.title}>
                你的回复
              </h3>
            </div>
            <article className={styles.delivered}>
              <header className={styles.deliveredHead}>
                <Avatar name={user.display_name} src={user.avatar_url} size={28} />
                <div className={styles.deliveredMeta}>
                  <span className={styles.deliveredName}>{user.display_name}</span>
                  <span className={styles.deliveredTime} title={fullTime(answer.confirmed_at ?? answer.published_at ?? answer.sent_at ?? answer.updated_at)}>
                    {answer.visibility === "public" ? "公开发布于 " : "已确认于 "}
                    {relativeTime(answer.confirmed_at ?? answer.published_at ?? answer.sent_at ?? answer.updated_at)}
                    {answer.seen_at ? " · 提问者已查看" : ""}
                  </span>
                </div>
                <span className={styles.visibilityTag} data-visibility={answer.visibility}>
                  {answer.visibility === "public" ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
                  {answer.visibility === "public" ? "公开" : "私密"}
                </span>
              </header>
              <p className={styles.deliveredText}>{snapshot ?? answer.content}</p>
              {!snapshot && (
                <p className={styles.legacyNote}>这是较早的确认记录，还没有可查看快照。再次确认后，提问者才能在查看链接里看到。</p>
              )}
              {snapshot && snapshot !== answer.content && (
                <p className={styles.legacyNote}>提问者看到的是已确认内容。草稿里还有未再次确认的修改。</p>
              )}
              <footer className={styles.deliveredFoot}>
                {answer.source === "ai_assisted" ? (
                  <span className={styles.sourceTag}>
                    <Sparkles aria-hidden="true" />
                    AI 协助起草
                  </span>
                ) : (
                  <span />
                )}
                <Button variant="ghost" size="sm" leadingIcon={<PencilLine />} onClick={() => setEditing(true)} disabled={locked}>
                  编辑回复
                </Button>
              </footer>
            </article>
          </m.div>
        ) : (
          <m.div key="editor" variants={fadeUp} initial="initial" animate="animate" exit={{ opacity: 0 }}>
            <div className={styles.sectionHead}>
              <h3 id="answer-title" className={styles.title}>
                你的回复
              </h3>
              {saveLabel && (
                <span className={saveState === "error" ? styles.saveError : styles.unsaved} role="status">
                  {saveLabel}
                </span>
              )}
              {saveState === "error" && (
                <Button variant="ghost" size="sm" onClick={() => void flush()}>
                  重试
                </Button>
              )}
              {source === "ai_assisted" && trimmed && (
                <span className={styles.sourceTag}>
                  <Sparkles aria-hidden="true" />
                  基于 AI 草稿
                </span>
              )}
            </div>

            <div ref={scope} className={styles.editor} data-invalid={tooLong || undefined}>
              <label htmlFor={`answer-${question.id}`} className="visually-hidden">
                回复内容
              </label>
              <Textarea
                ref={textareaRef}
                id={`answer-${question.id}`}
                className={styles.textarea}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={locked ? "这个问题已被标记为垃圾，恢复后才能回复。" : "用你自己的话回复…"}
                minRows={4}
                maxRows={16}
                disabled={locked}
                invalid={tooLong}
              />
              <div className={styles.editorBar}>
                {canPublic ? (
                  <SegmentedControl
                    label="回复可见性"
                    size="sm"
                    value={visibility}
                    onChange={setVisibility}
                    options={[
                      { value: "private", label: "私密", icon: <Lock /> },
                      { value: "public", label: "公开", icon: <Globe /> },
                    ]}
                  />
                ) : (
                  <p className={styles.privateHint}>
                    <Lock aria-hidden="true" />
                    确认后写入查看链接。公开发布目前关闭。
                  </p>
                )}
                <div className={styles.editorActions}>
                  {content.length > ANSWER_MAX * 0.8 && <Counter value={content.length} max={ANSWER_MAX} />}
                  {deliveredBefore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContent(answer?.content ?? "");
                        setVisibility(canPublic ? (answer?.visibility ?? "private") : "private");
                        setEditing(false);
                      }}
                    >
                      取消
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Check />}
                    onClick={requestDeliver}
                    disabled={!trimmed || tooLong || locked || pending === "deliver"}
                  >
                    {deliveredBefore ? "更新回复" : "确认回复"}
                  </Button>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmOpen}
        title={effectiveVisibility === "public" ? "公开发布这条回复？" : "确认这条回复？"}
        description={
          effectiveVisibility === "public"
            ? "提问者提交时已同意公开。确认后，问题和这段回复会出现在公开页，并写入查看链接里的快照。提问者的称呼不会公开。"
            : "确认后，这段文字会写入提问者查看链接里的快照。之后继续改草稿，在再次确认之前，提问者看不到新内容。这不是邮件或短信送达。"
        }
        confirmLabel={effectiveVisibility === "public" ? "公开发布" : "确认回复"}
        variant={effectiveVisibility === "public" ? "accent" : "primary"}
        loading={pending === "deliver"}
        onConfirm={() => void deliver()}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className={styles.preview}>
          <p className={styles.previewQuestion}>{truncate(question.content, 80)}</p>
          <p className={styles.previewAnswer}>{trimmed}</p>
        </div>
        {source === "ai_assisted" && (
          <p className={styles.previewNote}>
            <Sparkles aria-hidden="true" />
            这条回复基于 AI 草稿。模型可能写错，请确认内容准确、符合你的本意。
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={replace !== null}
        title="替换当前的回复内容？"
        description="回复框里已经有你写的内容，采用草稿会覆盖它。"
        confirmLabel="替换"
        onConfirm={() => replace !== null && applyDraft(replace)}
        onCancel={() => setReplace(null)}
      />

      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title="回复还没保存"
        description="离开前可以选择保存草稿、放弃这次修改，或留在这里。"
        footer={
          <>
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              取消
            </Button>
            <Button variant="secondary" onClick={discardAndLeave}>
              放弃
            </Button>
            <Button variant="primary" onClick={() => void saveAndLeave()}>
              保存
            </Button>
          </>
        }
      />
    </section>
  );
}
