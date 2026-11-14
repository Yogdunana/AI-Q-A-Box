import { Avatar } from "../../components/ui/Display";
import { cx } from "../../lib/cx";
import styles from "./BoxIdentity.module.css";

interface BoxIdentityProps {
  ownerName: string;
  avatarUrl?: string | null;
  slug: string;
  title: string;
  description?: string;
  size?: "md" | "sm";
  as?: "h1" | "p";
}

/** Owner identity + box title, as shown at the top of a public question box. */
export function BoxIdentity({ ownerName, avatarUrl, slug, title, description, size = "md", as = "h1" }: BoxIdentityProps) {
  const Title = as;
  return (
    <div className={cx(styles.identity, styles[size])}>
      <div className={styles.owner}>
        <Avatar name={ownerName || "?"} src={avatarUrl} size={size === "sm" ? 36 : 44} />
        <div className={styles.ownerText}>
          <span className={styles.ownerName}>{ownerName}</span>
          <span className={styles.handle}>@{slug}</span>
        </div>
      </div>
      <Title className={styles.title}>{title}</Title>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
