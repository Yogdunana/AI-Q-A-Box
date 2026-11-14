import type { ReactNode } from "react";
import { useBlocker, useNavigate } from "react-router";
import { AnimatePresence, m } from "motion/react";
import { Page } from "../../components/layout/Page";
import { SubpageBar } from "../../components/layout/SubpageBar";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { useBeforeUnload, useLayout } from "../../lib/hooks";
import { duration, ease } from "../../lib/motion";
import styles from "./Settings.module.css";

interface SettingsFrameProps {
  title: string;
  description?: string;
  children: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onSave?(): void;
  onDiscard?(): void;
}

/**
 * Chrome around one settings section: a back bar when it is a pushed page on a
 * phone, a heading when it sits beside the section list, plus the save bar and
 * a guard against leaving with unsaved edits.
 */
export function SettingsFrame({ title, description, children, dirty = false, saving, onSave, onDiscard }: SettingsFrameProps) {
  const { split } = useLayout();
  const navigate = useNavigate();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useBeforeUnload(dirty);

  const body = (
    <>
      {split ? (
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description && <p className={styles.sectionDescription}>{description}</p>}
        </header>
      ) : (
        description && <p className={styles.sectionLead}>{description}</p>
      )}
      <div className={styles.sectionBody}>{children}</div>
    </>
  );

  return (
    <>
      {split ? (
        <div className={styles.sectionWrap}>{body}</div>
      ) : (
        <>
          <SubpageBar title={title} backLabel="设置" onBack={() => navigate("/app/settings")} />
          <Page width="narrow" className={styles.subpage}>
            {body}
          </Page>
        </>
      )}

      <AnimatePresence>
        {dirty && onSave && (
          <m.div
            className={styles.saveBar}
            role="region"
            aria-label="保存更改"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
            exit={{ opacity: 0, y: 24, transition: { duration: duration.fast, ease: ease.in } }}
          >
            <span className={styles.saveText}>有未保存的更改</span>
            <div className={styles.saveActions}>
              <Button variant="ghost" size="sm" className={styles.discard} onClick={onDiscard} disabled={saving}>
                放弃
              </Button>
              <Button variant="accent" size="sm" onClick={onSave} loading={saving}>
                保存更改
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="放弃未保存的更改？"
        description="离开这个页面后，刚才的修改不会保存。"
        confirmLabel="放弃更改"
        cancelLabel="继续编辑"
        variant="danger"
        onConfirm={() => {
          onDiscard?.();
          blocker.proceed?.();
        }}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}
