import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { m } from "motion/react";
import { duration, ease } from "../../lib/motion";

/** Smoothly animates its height whenever the content's natural height changes. */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <m.div
      className={className}
      style={{ overflow: "hidden" }}
      initial={false}
      animate={{ height }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <div ref={innerRef}>{children}</div>
    </m.div>
  );
}
