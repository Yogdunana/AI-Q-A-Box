import { m } from "motion/react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "../../components/brand/Brand";
import { ButtonLink } from "../../components/ui/Button";
import { ease } from "../../lib/motion";
import { useSession } from "../../state/session";
import { QuestionVignette } from "./QuestionVignette";
import styles from "./LandingPage.module.css";

const YEAR = new Date().getFullYear();

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: ease.out, delay } },
});

export function LandingPage() {
  const { session } = useSession();
  const signedIn = Boolean(session);

  return (
    <div className={styles.landing}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            <m.span className={styles.line} {...rise(0.05)}>
              收下每一句
            </m.span>
            <m.span className={styles.line} {...rise(0.14)}>
              <span className={`${styles.quote} ${styles.quoteOpen}`}>“</span>想问你的话<span className={styles.quote}>”</span>
            </m.span>
          </h1>
          <m.p className={styles.lede} {...rise(0.26)}>
            一个属于你的提问箱。分享一条链接，让问题安静地抵达，再从容地回答。
          </m.p>
          <m.div className={styles.actions} {...rise(0.36)}>
            {signedIn ? (
              <>
                <ButtonLink to="/app" variant="primary" size="lg" trailingIcon={<ArrowRight />}>
                  进入工作台
                </ButtonLink>
                {session?.box && (
                  <ButtonLink to={`/${session.box.slug}`} variant="ghost" size="lg">
                    查看我的提问箱
                  </ButtonLink>
                )}
              </>
            ) : (
              <>
                <ButtonLink to="/auth/register" variant="primary" size="lg" trailingIcon={<ArrowRight />}>
                  创建我的提问箱
                </ButtonLink>
                <ButtonLink to="/auth/login" variant="ghost" size="lg">
                  登录
                </ButtonLink>
              </>
            )}
          </m.div>
        </div>

        <m.div
          className={styles.visual}
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: ease.out, delay: 0.3 } }}
        >
          <QuestionVignette />
        </m.div>
      </main>

      <m.footer className={styles.footer} {...rise(0.5)}>
        <BrandLogo />
        <p className={styles.copyright}>© {YEAR} Digital Self</p>
      </m.footer>
    </div>
  );
}
