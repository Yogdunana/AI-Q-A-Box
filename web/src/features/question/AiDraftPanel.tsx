import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, CornerDownLeft, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { api, isApiError, messageFor, type AiGeneration, type QuestionDetail } from "../../api";
import { AutoHeight } from "../../components/ui/AutoHeight";
import { Button, IconButton } from "../../components/ui/Button";
import { relativeTime, fullTime } from "../../lib/format";
import { useCopy } from "../../lib/hooks";
import { duration, ease } from "../../lib/motion";
import { invalidate, setQueryData } from "../../lib/query";
import { useToast } from "../../state/toast";
import { StreamingText } from "./StreamingText";
import { detailKey } from "./useQuestionActions";
import styles from "./AiDraftPanel.module.css";

interface AiDraftPanelProps {
  detail: QuestionDetail;
  onAdopt(text: string): void;
  locked?: boolean;
}

type Phase = "ready" | "generating" | "error";

const swap = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.instant } },
};

export function AiDraftPanel({ detail, onAdopt, locked }: AiDraftPanelProps) {
  const toast = useToast();
  const titleId = useId();
  const { copied, copy } = useCopy();
  const { question, generations } = detail;
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(generations.length - 1);
  const [freshId, setFreshId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const safeIndex = Math.max(0, Math.min(index, generations.length - 1));
  const current: AiGeneration | undefined = generations[safeIndex];

  async function generate() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPhase("generating");
    setError(null);
    try {
      const generation = await api.generateDraft(question.id, abort.signal);
      setQueryData<QuestionDetail>(detailKey(question.id), (d) => {
        if (!d) return d;
        const status =
          d.question.status === "submitted" || d.question.status === "reviewing" ? "drafted" : d.question.status;
        return { ...d, question: { ...d.question, status }, generations: [...d.generations, generation] };
      });
      invalidate("questions:list:", "questions:counts");
      setFreshId(generation.id);
      setIndex(generations.length);
      setPhase("ready");
    } catch (err) {
      if (isApiError(err, "aborted")) {
        setPhase("ready");
        return;
      }
      setError(messageFor(err));
      setPhase("error");
    }
  }

  function cancel() {
    controller.current?.abort();
    setPhase("ready");
    toast.info("已取消生成");
  }

  async function discard(generation: AiGeneration) {
    try {
      await api.deleteDraft(question.id, generation.id);
      setQueryData<QuestionDetail>(detailKey(question.id), (d) =>
        d ? { ...d, generations: d.generations.filter((g) => g.id !== generation.id) } : d,
      );
      invalidate("questions:");
      toast.success("草稿已丢弃");
    } catch (err) {
      toast.error(messageFor(err));
    }
  }

  const view: "empty" | "generating" | "error" | "draft" =
    phase === "generating" ? "generating" : phase === "error" ? "error" : current ? "draft" : "empty";

  return (
    <section className={styles.panel} aria-labelledby={titleId} data-view={view} aria-busy={view === "generating"}>
      <header className={styles.head}>
        <h3 id={titleId} className={styles.label}>
          <Sparkles aria-hidden="true" />
          AI 草稿
        </h3>
        {generations.length > 1 && view === "draft" && (
          <div className={styles.pager}>
            <IconButton size="sm" label="上一版" disabled={safeIndex <= 0} onClick={() => setIndex(safeIndex - 1)}>
              <ChevronLeft />
            </IconButton>
            <span className={styles.pagerText} aria-live="polite">
              第 {safeIndex + 1} / {generations.length} 版
            </span>
            <IconButton
              size="sm"
              label="下一版"
              disabled={safeIndex >= generations.length - 1}
              onClick={() => setIndex(safeIndex + 1)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        )}
        <span className={styles.notice}>发布前请核对</span>
      </header>

      <AutoHeight>
        <AnimatePresence mode="wait" initial={false}>
          {view === "empty" && (
            <m.div key="empty" className={styles.body} {...swap}>
              <p className={styles.intro}>
                按照你在设置里保存的回复风格，先起草一版。草稿只给你看，不会自动发送。
              </p>
              <Button variant="ai" leadingIcon={<Sparkles />} onClick={generate} disabled={locked}>
                生成回复草稿
              </Button>
            </m.div>
          )}

          {view === "generating" && (
            <m.div key="generating" className={styles.body} {...swap}>
              <div className={styles.thinking} role="status">
                <span className={styles.orbs} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                正在起草…
              </div>
              <div className={styles.lines} aria-hidden="true">
                <span style={{ width: "92%" }} />
                <span style={{ width: "78%" }} />
                <span style={{ width: "54%" }} />
              </div>
              <Button variant="ghost" size="sm" onClick={cancel} className={styles.cancel}>
                取消
              </Button>
            </m.div>
          )}

          {view === "error" && (
            <m.div key="error" className={styles.body} {...swap}>
              <div className={styles.error} role="alert">
                <AlertCircle aria-hidden="true" />
                <div>
                  <p className={styles.errorTitle}>{error}</p>
                  <p className={styles.errorBody}>问题和你写的内容都还在，你也可以直接手动回复。</p>
                </div>
              </div>
              <div className={styles.actions}>
                <Button variant="ai" size="sm" leadingIcon={<RotateCw />} onClick={generate}>
                  重试
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPhase("ready")}>
                  先不用了
                </Button>
              </div>
            </m.div>
          )}

          {view === "draft" && current && (
            <m.div key={`draft-${current.id}`} className={styles.body} {...swap}>
              <div className={styles.draftText}>
                <StreamingText
                  text={current.output}
                  animate={current.id === freshId}
                  onDone={() => setFreshId(null)}
                />
              </div>
              <div className={styles.footer}>
                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<CornerDownLeft />}
                    onClick={() => onAdopt(current.output)}
                    disabled={locked || current.id === freshId}
                  >
                    采用并编辑
                  </Button>
                  <Button variant="ghost" size="sm" leadingIcon={<RotateCw />} onClick={generate} disabled={locked}>
                    重新生成
                  </Button>
                  <IconButton
                    size="sm"
                    label={copied ? "已复制" : "复制草稿"}
                    onClick={async () => {
                      if (await copy(current.output)) toast.success("草稿已复制");
                    }}
                  >
                    {copied ? <Check /> : <Copy />}
                  </IconButton>
                  <IconButton size="sm" label="丢弃这一版" onClick={() => discard(current)} disabled={locked}>
                    <Trash2 />
                  </IconButton>
                </div>
                <span className={styles.meta} title={`${current.provider} / ${current.model} · ${fullTime(current.created_at)}`}>
                  {current.model} · {relativeTime(current.created_at)}
                </span>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </AutoHeight>
    </section>
  );
}
