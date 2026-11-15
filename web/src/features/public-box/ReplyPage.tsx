import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, RefreshCw, SearchX } from "lucide-react";
import { api, isApiError, messageFor, type ReplyAccess } from "../../api";
import { BrandName, PRODUCT_NAME } from "../../components/brand/Brand";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Display";
import { activeReplyToken, rememberReplyToken } from "../../lib/view-token";
import styles from "./ReplyPage.module.css";

type Phase =
  | { kind: "missing" }
  | { kind: "loading" }
  | { kind: "ready"; access: ReplyAccess }
  | { kind: "invalid" }
  | { kind: "limited" }
  | { kind: "error"; message: string };

function initialReplyToken(): string {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    rememberReplyToken(hash);
    window.history.replaceState(window.history.state, "", "/reply");
    return hash;
  }
  return activeReplyToken() ?? "";
}

export function ReplyPage() {
  const [token] = useState(initialReplyToken);
  const [phase, setPhase] = useState<Phase>(token ? { kind: "loading" } : { kind: "missing" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.readReply(token).then(
      (access) => {
        if (!cancelled) setPhase({ kind: "ready", access });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (isApiError(error, "not_found")) setPhase({ kind: "invalid" });
        else if (isApiError(error, "rate_limited")) setPhase({ kind: "limited" });
        else setPhase({ kind: "error", message: messageFor(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  useEffect(() => {
    document.title = `查看回复 · ${PRODUCT_NAME}`;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>
      <main className={styles.main}>
        {phase.kind === "loading" ? (
          <p className={styles.status}>正在查看回复…</p>
        ) : phase.kind === "missing" ? (
          <EmptyState
            icon={<SearchX />}
            title="没有查看链接"
            body="打开当初保存的链接才能查看回复。链接不在地址里时，刷新这个页面无法找回它。"
          />
        ) : phase.kind === "invalid" ? (
          <EmptyState icon={<SearchX />} title="链接无效" body="这个查看链接无法使用。请核对完整链接，或使用当初保存的那一份。" />
        ) : phase.kind === "limited" ? (
          <EmptyState
            icon={<AlertCircle />}
            title="查看过于频繁"
            body="请稍等一会儿再打开这个链接。"
            actions={
              <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
                重试
              </Button>
            }
          />
        ) : phase.kind === "error" ? (
          <EmptyState
            icon={<AlertCircle />}
            tone="danger"
            title="暂时没有查到"
            body={phase.message}
            actions={
              <Button variant="primary" leadingIcon={<RefreshCw />} onClick={() => setAttempt((n) => n + 1)}>
                重试
              </Button>
            }
          />
        ) : (
          <ReplyBody access={phase.access} />
        )}
      </main>
      <footer className={styles.footer}>
        <Link to="/" className={styles.footerLink}>
          {PRODUCT_NAME}
        </Link>
      </footer>
    </div>
  );
}

function ReplyBody({ access }: { access: ReplyAccess }) {
  if (access.state === "deleted") {
    return <EmptyState icon={<SearchX />} title="问题已删除" body="箱主删除了这个问题，回复也不再提供查看。" />;
  }
  return (
    <article className={styles.card}>
      <p className={styles.kicker}>{access.box?.owner_display_name || "箱主"} · {access.box?.title}</p>
      <h1 className={styles.title}>你的问题</h1>
      <p className={styles.question}>{access.question?.content}</p>
      {access.state === "confirmed" && access.reply ? (
        <>
          <h2 className={styles.replyTitle}>已确认的回复</h2>
          <p className={styles.reply}>{access.reply.content}</p>
          <p className={styles.note}>这是箱主确认时留下的内容。之后未再次确认的修改不会出现在这里。</p>
        </>
      ) : (
        <>
          <h2 className={styles.replyTitle}>回复还没有确认</h2>
          <p className={styles.note}>箱主还没有确认可查看的回复。可以稍后用同一个链接再来看。这里不会显示草稿。</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            重新查看
          </Button>
        </>
      )}
    </article>
  );
}
