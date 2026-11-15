import { Link, useLocation, useParams } from "react-router";
import { m } from "motion/react";
import { Link2, PenLine } from "lucide-react";
import { BrandName, PRODUCT_NAME } from "../../components/brand/Brand";
import { Button, ButtonLink } from "../../components/ui/Button";
import { runtime } from "../../config/runtime";
import { useCopy } from "../../lib/hooks";
import { ease, fadeUp, stagger } from "../../lib/motion";
import { replyLink, submittedToken } from "../../lib/view-token";
import styles from "./SubmittedPage.module.css";

interface SubmittedState {
  question?: string;
  ownerName?: string;
  viewToken?: string;
}

export function SubmittedPage() {
  const { slug = "" } = useParams();
  const state = (useLocation().state ?? {}) as SubmittedState;
  const owner = state.ownerName ?? "箱主";
  const token = state.viewToken || submittedToken(slug);
  const link = token ? replyLink(token) : "";
  const { copied, copy } = useCopy();

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>
      <main className={styles.main}>
        <m.div className={styles.content} variants={stagger(0.08, 0.35)} initial="initial" animate="animate">
          <SuccessMark />
          <m.h1 className={styles.title} variants={fadeUp}>
            问题已提交
          </m.h1>
          <m.p className={styles.body} variants={fadeUp} role="status">
            {owner} 打开收件箱时会看到它。请保存下面的查看链接，用来查看已经确认的回复。
          </m.p>

          {state.question && (
            <m.figure className={styles.letter} variants={fadeUp}>
              <blockquote className={styles.quote}>{state.question}</blockquote>
              <figcaption className={styles.caption}>你的问题</figcaption>
            </m.figure>
          )}

          <m.div className={styles.linkBox} variants={fadeUp}>
            {link ? (
              <>
                <label className={styles.linkLabel} htmlFor="reply-link">
                  查看链接
                </label>
                <input id="reply-link" className={styles.linkField} readOnly value={link} />
                <div className={styles.linkActions}>
                  <Button type="button" variant="primary" leadingIcon={<Link2 />} onClick={() => void copy(link)}>
                    {copied ? "已复制" : "保存查看链接"}
                  </Button>
                  <ButtonLink to={`/reply#${token}`} variant="secondary">
                    查看回复
                  </ButtonLink>
                </div>
                <p className={styles.linkNote}>
                  这个链接就是查看凭证。不要分享给别人。丢失后无法找回，平台也不会用邮件或短信补发。
                  {runtime.apiMode === "mock" ? "演示模式下，它只在当前浏览器里有效。" : ""}
                </p>
              </>
            ) : (
              <p className={styles.linkNote}>
                这次没有找到查看链接。如果页面被刷新前没有保存，就无法再取回。可以再提交一次新问题。
              </p>
            )}
          </m.div>

          <m.div className={styles.actions} variants={fadeUp}>
            <ButtonLink to={`/${slug}`} variant="secondary" size="lg" leadingIcon={<PenLine />}>
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
