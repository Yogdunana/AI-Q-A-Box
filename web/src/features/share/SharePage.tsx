import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, m } from "motion/react";
import { Check, Copy, ExternalLink, PartyPopper, PauseCircle, Share2, X } from "lucide-react";
import { Card, Page, PageHeader } from "../../components/layout/Page";
import { Button, ButtonLink, IconButton } from "../../components/ui/Button";
import { boxUrl, displayHost } from "../../lib/format";
import { useCopy } from "../../lib/hooks";
import { duration, ease, fadeUp, stagger } from "../../lib/motion";
import { useOwner } from "../../state/session";
import { useToast } from "../../state/toast";
import { BoxIdentity } from "../public-box/BoxIdentity";
import styles from "./SharePage.module.css";

const TEMPLATES = [
  { id: "bio", label: "个人简介", text: (url: string) => `有问题想问我？来这里：${url}` },
  { id: "post", label: "动态 / 帖子", text: (url: string) => `开了一个提问箱，什么都可以问，也可以匿名。我会认真挑着回答：${url}` },
  { id: "group", label: "群聊", text: (url: string) => `大家有想问我的，可以匿名丢到这里：${url}` },
];

export function SharePage() {
  const { user, box } = useOwner();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const url = boxUrl(box.slug);
  const link = useCopy();
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const templateCopy = useCopy();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Page>
      <AnimatePresence initial={false}>
        {welcome && (
          <m.div
            className={styles.welcomeWrap}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: duration.slow, ease: ease.out, delay: 0.1 } }}
            exit={{ opacity: 0, height: 0, transition: { duration: duration.base, ease: ease.inOut } }}
          >
            <div className={styles.welcome} role="status">
              <span className={styles.welcomeIcon} aria-hidden="true">
                <PartyPopper />
              </span>
              <div className={styles.welcomeText}>
                <p className={styles.welcomeTitle}>你的提问箱已经准备好了</p>
                <p className={styles.welcomeBody}>复制下面的链接，放到大家能看到的地方。新问题会出现在收件箱里。</p>
              </div>
              <IconButton size="sm" label="关闭提示" onClick={() => setParams({}, { replace: true })}>
                <X />
              </IconButton>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <PageHeader title="分享" description="一条链接，就是你的提问箱。" />

      {box.status === "paused" && (
        <div className={styles.paused} role="status">
          <PauseCircle aria-hidden="true" />
          <span>提问箱已暂停，访客暂时无法提问。</span>
          <Link to="/app/settings" className={styles.pausedLink}>
            去设置
          </Link>
        </div>
      )}

      <m.div className={styles.grid} variants={stagger(0.06)} initial="initial" animate="animate">
        <div className={styles.mainCol}>
          <m.div variants={fadeUp}>
            <Card className={styles.linkCard}>
              <p className={styles.label}>你的链接</p>
              <p className={styles.url}>
                <span className={styles.urlHost}>{displayHost()}/</span>
                <span className={styles.urlSlug}>{box.slug}</span>
              </p>
              <div className={styles.linkActions}>
                <Button
                  variant="primary"
                  leadingIcon={link.copied ? <Check /> : <Copy />}
                  onClick={async () => {
                    if (await link.copy(url)) toast.success("链接已复制");
                    else toast.error("复制失败，请手动选择链接复制。");
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <m.span
                      key={link.copied ? "done" : "idle"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: duration.fast }}
                    >
                      {link.copied ? "已复制" : "复制链接"}
                    </m.span>
                  </AnimatePresence>
                </Button>
                <ButtonLink to={`/${box.slug}`} target="_blank" rel="noreferrer" variant="secondary" leadingIcon={<ExternalLink />}>
                  打开公开页
                </ButtonLink>
                {canShare && (
                  <Button
                    variant="ghost"
                    leadingIcon={<Share2 />}
                    onClick={() => {
                      navigator.share({ title: box.title, text: `向 ${user.display_name} 提问`, url }).catch(() => {});
                    }}
                  >
                    分享…
                  </Button>
                )}
              </div>
            </Card>
          </m.div>

          <m.section variants={fadeUp} className={styles.templates} aria-labelledby="templates-title">
            <h2 id="templates-title" className={styles.sectionTitle}>
              可以直接用的分享文案
            </h2>
            <ul className={styles.templateList}>
              {TEMPLATES.map((t) => {
                const text = t.text(url);
                const done = templateCopy.copied && copiedTemplate === t.id;
                return (
                  <li key={t.id} className={styles.template}>
                    <div className={styles.templateBody}>
                      <span className={styles.templateLabel}>{t.label}</span>
                      <p className={styles.templateText}>{text}</p>
                    </div>
                    <IconButton
                      label={done ? "已复制" : `复制“${t.label}”文案`}
                      onClick={async () => {
                        setCopiedTemplate(t.id);
                        if (await templateCopy.copy(text)) toast.success("文案已复制");
                      }}
                    >
                      {done ? <Check /> : <Copy />}
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </m.section>
        </div>

        <m.aside variants={fadeUp} className={styles.previewCol} aria-label="访客看到的页面">
          <p className={styles.label}>访客看到的样子</p>
          <div className={styles.device}>
            <div className={styles.deviceBar} aria-hidden="true">
              <span className={styles.deviceUrl}>
                {displayHost()}/{box.slug}
              </span>
            </div>
            <div className={styles.deviceBody}>
              <BoxIdentity
                as="p"
                size="sm"
                ownerName={user.display_name}
                avatarUrl={user.avatar_url}
                slug={box.slug}
                title={box.title}
                description={box.description}
              />
              <div className={styles.fakeInput} aria-hidden="true">
                {box.status === "active" ? `写下你想问 ${user.display_name} 的问题…` : "暂时不接收新问题"}
              </div>
            </div>
          </div>
        </m.aside>
      </m.div>
    </Page>
  );
}
