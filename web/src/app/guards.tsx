import { Navigate, Outlet, useLocation } from "react-router";
import { RefreshCw, WifiOff } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Display";
import { Spinner } from "../components/ui/Spinner";
import { useSession } from "../state/session";
import styles from "./guards.module.css";

export function FullPageLoader() {
  return (
    <div className={styles.center}>
      <Spinner size={20} label="加载中" />
    </div>
  );
}

function SessionError() {
  const { retry } = useSession();
  return (
    <div className={styles.center}>
      <EmptyState
        icon={<WifiOff />}
        tone="danger"
        title="暂时连接不上"
        body="无法确认你的登录状态。请检查网络后重试。"
        actions={
          <Button variant="primary" leadingIcon={<RefreshCw />} onClick={retry}>
            重试
          </Button>
        }
      />
    </div>
  );
}

export function RequireAuth() {
  const { status, session } = useSession();
  const location = useLocation();
  if (status === "loading") return <FullPageLoader />;
  if (status === "error") return <SessionError />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

export function OwnerLayout() {
  const { session } = useSession();
  if (!session?.box) return <Navigate to="/app/setup" replace />;
  return <AppShell />;
}

export function SetupGate() {
  const { session } = useSession();
  if (session?.box) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { status, session } = useSession();
  const location = useLocation();
  if (status === "loading") return <FullPageLoader />;
  if (session) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next?.startsWith("/app") ? next : "/app"} replace />;
  }
  return <Outlet />;
}
