import { useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, m, useAnimate } from "motion/react";
import { Check, Globe, Lock, PencilLine, Sparkles } from "lucide-react";
import { api, messageFor, type Answer, type QuestionDetail, type ReplyVisibility } from "../../api";
import { Avatar } from "../../components/ui/Display";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { Counter, Textarea } from "../../components/ui/Field";
import { SegmentedControl } from "../../components/ui/Switch";
import { fullTime, relativeTime, truncate } from "../../lib/format";
import { useBeforeUnload } from "../../lib/hooks";
import { duration, ease, fadeUp } from "../../lib/motion";
import { invalidate, setQueryData } from "../../lib/query";
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

function isDelivered(answer: Answer | null): answer is Answer {
  return Boolean(answer && (answer.sent_at || answer.published_at));
}

export function AnswerComposer({ detail, locked, ref }: AnswerComposerProps) {
  const { box, user } = useOwner();
  const toast = useToast();
  const { question, answer } = detail;
  const [editing, setEditing] = useState(!isDelivered(answer));
  const [content, setContent] = useState(answer?.content ?? "");
  const [visibility, setVisibility] = useState<ReplyVisibility>(answer?.visibility ?? box.default_reply_visibility);
  const [source, setSource] = useState<Answer["source"]>(answer?.source ?? "human");
  const [pending, setPending] = useState<"save" | "deliver" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replace, setReplace] = useState<string | null>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saved = answer?.content ?? "";
  const dirty = content !== saved || (answer ? visibility !== answer.visibility : false);
  useBeforeUnload(editing && dirty && content.trim().length > 0);

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
    toast.info("草稿已放进回复框，修改后再确认发送");
  }

  useImperativeHandle(ref, () => ({
    adopt(text: string) {
      if (content.trim() && content.trim() !== text.trim()) setReplace(text);
      else applyDraft(text);
    },
  }));

  function writeAnswer(next: Answer, status?: QuestionDetail["question"]["status"]) {
    setQueryData<QuestionDetail>(detailKey(question.id), (d) =>
      d ? { ...d, answer: next, question: status ? { ...d.question, status } : d.question } : d,
    );
    invalidate("questions:list:", "questions:counts", "public:answers:");
  }

  async function persist(): Promise<Answer> {
    const input = { content: content.trim(), visibility, source };
    return answer ? api.updateAnswer(answer.id, input) : api.saveAnswer(question.id, input);
  }

  async function saveDraft() {
    if (!content.trim()) return;
    setPending("save");
    try {
      const next = await persist();
      const status =
        question.status === "submitted" || question.status === "reviewing" ? "drafted" : question.status;
      writeAnswer(next, status);
      setContent(next.content);
      toast.success("回复草稿已保存");
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setPending(null);
    }
  }

  async function deliver() {
    setPending("deliver");
    try {
      const savedAnswer = await persist();
      const delivered = await api.publishAnswer(savedAnswer.id, visibility);
      writeAnswer(delivered, visibility === "public" ? "published" : "answered_private");
      setConfirmOpen(false);
      setEditing(false);
      toast.success(visibility === "public" ? "回复已公开发布" : "已私密回复");
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setPending(null);
    }
  }

  function requestDeliver() {
    if (!content.trim() || content.length > ANSWER_MAX) {
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

  const tooLong = content.length > ANSWER_MAX;
  const deliveredBefore = isDelivered(answer);

  return (
    <section className={styles.section} aria-labelledby="answer-title">
      <AnimatePresence mode="wait" initial={false}>
        {!editing && deliveredBefore ? (
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
                  <span className={styles.deliveredTime} title={fullTime(answer.published_at ?? answer.sent_at!)}>
                    {answer.visibility === "public" ? "公开发布于 " : "私密回复于 "}
                    {relativeTime(answer.published_at ?? answer.sent_at!)}
                  </span>
                </div>
                <span className={styles.visibilityTag} data-visibility={answer.visibility}>
                  {answer.visibility === "public" ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
                  {answer.visibility === "public" ? "公开" : "私密"}
                </span>
              </header>
              <p className={styles.deliveredText}>{answer.content}</p>
              <footer className={styles.deliveredFoot}>
                {answer.source === "ai_assisted" ? (
                  <span className={styles.sourceTag}>
                    <Sparkles aria-hidden="true" />
                    AI 协助起草
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<PencilLine />}
                  onClick={() => setEditing(true)}
                  disabled={locked}
                >
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
              <AnimatePresence>
                {dirty && content.trim() && (
                  <m.span
                    className={styles.unsaved}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: duration.fast, ease: ease.out }}
                  >
                    未保存
                  </m.span>
                )}
              </AnimatePresence>
              {source === "ai_assisted" && content.trim() && (
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
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={locked ? "这个问题已被标记为垃圾，恢复后才能回复。" : "用你自己的话回复…"}
                minRows={4}
                maxRows={16}
                disabled={locked}
                invalid={tooLong}
              />
              <div className={styles.editorBar}>
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
                <div className={styles.editorActions}>
                  {content.length > ANSWER_MAX * 0.8 && <Counter value={content.length} max={ANSWER_MAX} />}
                  {deliveredBefore && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setContent(answer.content);
                      setVisibility(answer.visibility);
                      setEditing(false);
                    }}>
                      取消
                    </Button>
                  )}
                  {!deliveredBefore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={saveDraft}
                      loading={pending === "save"}
                      disabled={!content.trim() || !dirty || tooLong || locked || pending === "deliver"}
                    >
                      保存草稿
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Check />}
                    onClick={requestDeliver}
                    disabled={!content.trim() || tooLong || locked || pending === "save"}
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
        title={visibility === "public" ? "公开发布这条回复？" : "以私密方式回复？"}
        description={
          visibility === "public"
            ? "问题和回复会出现在你的公开提问箱页面上，所有访客都能看到。提问者的称呼不会被公开。"
            : "这条回复不会出现在公开页面上。"
        }
        confirmLabel={visibility === "public" ? "公开发布" : "确认回复"}
        variant={visibility === "public" ? "accent" : "primary"}
        loading={pending === "deliver"}
        onConfirm={deliver}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className={styles.preview}>
          <p className={styles.previewQuestion}>{truncate(question.content, 80)}</p>
          <p className={styles.previewAnswer}>{content.trim()}</p>
        </div>
        {source === "ai_assisted" && (
          <p className={styles.previewNote}>
            <Sparkles aria-hidden="true" />
            这条回复基于 AI 草稿，请确认内容准确、符合你的本意。
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
    </section>
  );
}
