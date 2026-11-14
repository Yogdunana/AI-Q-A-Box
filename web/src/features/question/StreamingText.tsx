import { useEffect, useEffectEvent, useState } from "react";
import { usePrefersReducedMotion } from "../../lib/hooks";
import styles from "./StreamingText.module.css";

/**
 * Reveals text progressively, the way a streamed model response arrives.
 * The full text is exposed to assistive tech immediately. Mount with a new key
 * for each new text.
 */
export function StreamingText({ text, animate, onDone }: { text: string; animate: boolean; onDone?(): void }) {
  const reduced = usePrefersReducedMotion();
  const chars = Array.from(text);
  const instant = !animate || reduced;
  const total = chars.length;
  const [revealed, setRevealed] = useState(0);
  const onFinished = useEffectEvent(() => onDone?.());

  useEffect(() => {
    if (instant) return;
    const duration = Math.min(1400, Math.max(500, total * 9));
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 1.6);
      setRevealed(Math.round(eased * total));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else onFinished();
    });
    return () => cancelAnimationFrame(frame);
  }, [total, instant]);

  const shown = instant ? total : revealed;
  const done = shown >= total;
  return (
    <div className={styles.text}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {chars.slice(0, shown).join("")}
        {!done && <span className={styles.cursor} />}
      </span>
    </div>
  );
}
