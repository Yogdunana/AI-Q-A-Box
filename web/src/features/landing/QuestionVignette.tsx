import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowUp, Inbox } from "lucide-react";
import { Avatar } from "../../components/ui/Display";
import { usePrefersReducedMotion } from "../../lib/hooks";
import { ease, spring } from "../../lib/motion";
import styles from "./QuestionVignette.module.css";

const SAMPLES = [
  "你是怎么开始做独立产品的？",
  "最近在读什么书？有没有想推荐的？",
  "如果重来一次，你还会选择现在的职业吗？",
];

type Phase = "typing" | "holding" | "sending" | "sent";

/** Decorative product vignette: a visitor types, sends, and the owner's inbox ticks up. */
export function QuestionVignette() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [count, setCount] = useState(3);
  const [flying, setFlying] = useState<{ id: number; text: string } | null>(null);

  const sample = SAMPLES[index];

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed < Array.from(sample).length) {
        timer = setTimeout(() => setTyped((n) => n + 1), 70 + Math.random() * 60);
      } else {
        timer = setTimeout(() => setPhase("holding"), 200);
      }
    } else if (phase === "holding") {
      timer = setTimeout(() => setPhase("sending"), 1100);
    } else if (phase === "sending") {
      timer = setTimeout(() => {
        setFlying({ id: Date.now(), text: sample });
        setTyped(0);
        setPhase("sent");
      }, 180);
    } else {
      timer = setTimeout(() => setCount((c) => c + 1), 520);
      const next = setTimeout(() => {
        setIndex((i) => (i + 1) % SAMPLES.length);
        setPhase("typing");
      }, 1900);
      return () => {
        clearTimeout(timer);
        clearTimeout(next);
      };
    }
    return () => clearTimeout(timer);
  }, [phase, typed, sample, reduced]);

  const text = reduced ? sample : Array.from(sample).slice(0, typed).join("");
  const ready = reduced || phase === "holding" || phase === "sending";

  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.paperBack2} />
      <div className={styles.paperBack1} />

      <div className={styles.card}>
        <div className={styles.owner}>
          <Avatar name="林一" size={36} />
          <div className={styles.ownerText}>
            <span className={styles.ownerName}>林一</span>
            <span className={styles.ownerHandle}>@lin</span>
          </div>
        </div>
        <p className={styles.boxTitle}>问我任何事</p>

        <div className={styles.composer} data-active={phase === "typing" && typed > 0}>
          <p className={styles.typed}>
            {text ? text : <span className={styles.placeholder}>写下你想问的…</span>}
            {!reduced && phase !== "sent" && <span className={styles.caret} />}
          </p>
        </div>

        <div className={styles.footerRow}>
          <span className={styles.anon}>
            <span className={styles.toggle}>
              <span className={styles.toggleThumb} />
            </span>
            匿名提问
          </span>
          <m.span
            className={styles.send}
            data-ready={ready}
            animate={{ scale: phase === "sending" ? 0.92 : 1 }}
            transition={spring.snappy}
          >
            发送
            <ArrowUp />
          </m.span>
        </div>

        <AnimatePresence>
          {flying && (
            <m.div
              key={flying.id}
              className={styles.flying}
              initial={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              animate={{ opacity: 0, y: 150, x: 90, scale: 0.35, transition: { duration: 0.62, ease: ease.inOut } }}
              onAnimationComplete={() => setFlying(null)}
            >
              {flying.text}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.inboxChip}>
        <Inbox />
        <span>收件箱</span>
        <span className={styles.countWrap}>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={count}
              className={styles.count}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.24, ease: ease.out }}
            >
              {count}
            </m.span>
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}
