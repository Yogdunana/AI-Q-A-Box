import { Link } from "react-router";
import { cx } from "../../lib/cx";
import styles from "./Brand.module.css";

/**
 * Path to the owner-provided logo under web/public/brand/. It stays null until
 * the original file is committed: the repository rules forbid drawing a
 * substitute, so the product name is shown as plain text in the meantime.
 */
export const BRAND_LOGO_SRC: string | null = null;

export const PRODUCT_NAME = "Ask “Me”";
export const STUDIO_NAME = "Digital Self";

export function BrandName({ to = "/", className, size = "md" }: { to?: string | null; className?: string; size?: "sm" | "md" }) {
  const content = <span className={cx(styles.name, styles[size])}>{PRODUCT_NAME}</span>;
  if (to === null) return <span className={className}>{content}</span>;
  return (
    <Link to={to} className={cx(styles.link, className)} aria-label={`${PRODUCT_NAME} 首页`}>
      {content}
    </Link>
  );
}

/** Logo block for the bottom of the landing page (docs/prd.md §5.2). */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cx(styles.logo, className)}>
      {BRAND_LOGO_SRC ? (
        <img src={BRAND_LOGO_SRC} alt={PRODUCT_NAME} className={styles.logoImage} />
      ) : (
        <span className={styles.logoText}>{PRODUCT_NAME}</span>
      )}
      <span className={styles.studio}>{STUDIO_NAME}</span>
    </div>
  );
}
