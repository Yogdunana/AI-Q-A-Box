import { useRouteError } from "react-router";
import { Compass, RefreshCw, TriangleAlert } from "lucide-react";
import { BrandName } from "../../components/brand/Brand";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Display";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage({ inApp }: { inApp?: boolean }) {
  const content = (
    <EmptyState
      icon={<Compass />}
      title="这里什么都没有"
      body="你访问的页面不存在，或者地址有误。"
      actions={
        <ButtonLink to={inApp ? "/app" : "/"} variant="primary">
          {inApp ? "回到概览" : "回到首页"}
        </ButtonLink>
      }
    />
  );
  if (inApp) return <div className={styles.inApp}>{content}</div>;
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>
      <main className={styles.main}>{content}</main>
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>
      <main className={styles.main}>
        <EmptyState
          icon={<TriangleAlert />}
          tone="danger"
          title="页面出了点问题"
          body="刷新一下通常就能恢复。如果问题持续出现，请稍后再试。"
          actions={
            <Button variant="primary" leadingIcon={<RefreshCw />} onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      </main>
    </div>
  );
}
