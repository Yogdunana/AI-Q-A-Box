import { m } from "motion/react";
import { api } from "../../api";
import { Avatar, Skeleton } from "../../components/ui/Display";
import { relativeTime, fullTime } from "../../lib/format";
import { fadeUp, stagger } from "../../lib/motion";
import { useQuery } from "../../lib/query";
import styles from "./PublicAnswers.module.css";

export function PublicAnswers({ slug, ownerName }: { slug: string; ownerName: string }) {
  const { data, loading, error } = useQuery(`public:answers:${slug}`, () => api.getPublicAnswers(slug));

  // Answers are secondary to asking; failures here stay silent rather than competing with the form.
  if (error || (!loading && !data?.length)) return null;

  return (
    <section className={styles.section} aria-labelledby="public-answers-title">
      <div className={styles.head}>
        <h2 id="public-answers-title" className={styles.title}>
          公开的回答
        </h2>
        {data && <span className={styles.count}>{data.length}</span>}
      </div>

      {loading ? (
        <div className={styles.list}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.item}>
              <Skeleton width="72%" height={18} />
              <Skeleton width="100%" height={12} style={{ marginTop: 18 }} />
              <Skeleton width="84%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <m.ol className={styles.list} variants={stagger(0.05)} initial="initial" animate="animate">
          {data!.map((item) => (
            <m.li key={item.id} className={styles.item} variants={fadeUp}>
              <article>
                <h3 className={styles.question}>{item.question}</h3>
                <div className={styles.answer}>
                  <Avatar name={ownerName} size={24} />
                  <div className={styles.answerBody}>
                    <p className={styles.answerText}>{item.answer}</p>
                    <time className={styles.time} dateTime={item.published_at} title={fullTime(item.published_at)}>
                      {ownerName} · {relativeTime(item.published_at)}
                    </time>
                  </div>
                </div>
              </article>
            </m.li>
          ))}
        </m.ol>
      )}
    </section>
  );
}
