import { Link, useLocation, useParams } from "react-router";
import { m } from "motion/react";
import { PenLine } from "lucide-react";
import { BrandName, PRODUCT_NAME } from "../../components/brand/Brand";
import { ButtonLink } from "../../components/ui/Button";
import { ease, fadeUp, stagger } from "../../lib/motion";
import styles from "./SubmittedPage.module.css";

interface SubmittedState {
  question?: string;
  ownerName?: string;
}

export function SubmittedPage() {
  const { slug = "" } = useParams();
  const state = (useLocation().state ?? {}) as SubmittedState;
  const owner = state.ownerName ?? "箱主";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>
      <main className={styles.main}>
        <m.div className={styles.content} variants={stagger(0.08, 0.35)} initial="initial" animate="animate">
          <SuccessMark />
          <m.h1 className={styles.title} variants={fadeUp}>
            问题已送达
          </m.h1>
          <m.p className={styles.body} variants={fadeUp} role="status">
            {owner} 会在方便的时候看到它。
          </m.p>

          {state.question && (
            <m.figure className={styles.letter} variants={fadeUp}>
              <blockquote className={styles.quote}>{state.question}</blockquote>
              <figcaption className={styles.caption}>你的问题</figcaption>
            </m.figure>
          )}

          <m.div className={styles.actions} variants={fadeUp}>
            <ButtonLink to={`/${slug}`} variant="primary" size="lg" leadingIcon={<PenLine />}>
              再问一个
            </ButtonLink>
          </m.div>
        </m.div>
      </main>
      <footer className={styles.footer}>
        <Link to="/" className={styles.footerLink}>
          {PRODUCT_NAME} · 创建你自己的提问箱
        </Link>
      </footer>
    </div>
  );
}

function SuccessMark() {
  return (
    <m.div
      className={styles.mark}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
        <m.circle
          cx="28"
          cy="28"
          r="26"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: ease.out, delay: 0.05 }}
        />
        <m.path
          d="M18 28.5l7 7 13-14"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.32, ease: ease.out, delay: 0.38 }}
        />
      </svg>
    </m.div>
  );
}
