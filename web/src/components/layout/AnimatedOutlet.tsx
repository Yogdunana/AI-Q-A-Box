import { useLocation, useOutlet } from "react-router";
import { AnimatePresence, m } from "motion/react";
import { page } from "../../lib/motion";

interface AnimatedOutletProps {
  /** Derive the transition key; routes sharing a key swap without animating. */
  keyFor?: (pathname: string) => string;
  className?: string;
}

/**
 * Route outlet with enter/exit transitions. AnimatePresence keeps rendering the
 * outgoing element it last received, so the old page stays intact while it fades.
 */
export function AnimatedOutlet({ keyFor = (p) => p, className }: AnimatedOutletProps) {
  const location = useLocation();
  const outlet = useOutlet();
  const key = keyFor(location.pathname);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={key}
        className={className}
        variants={page}
        initial="initial"
        animate="animate"
        exit="exit"
        onAnimationStart={(definition) => {
          if (definition === "animate") window.scrollTo({ top: 0 });
        }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
