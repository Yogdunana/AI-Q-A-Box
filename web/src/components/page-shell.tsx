import Link from "next/link";

type PageShellProps = {
  title: string;
  purpose: string;
  notes?: string[];
  actions?: { href: string; label: string; secondary?: boolean }[];
  showLogoSlot?: boolean;
  wide?: boolean;
  splash?: boolean;
  children?: React.ReactNode;
};

export function PageShell({
  title,
  purpose,
  notes = [],
  actions = [],
  showLogoSlot = false,
  wide = false,
  splash = false,
  children,
}: PageShellProps) {
  return (
    <main className={["shell", wide ? "wide" : "", splash ? "splash" : ""].filter(Boolean).join(" ")}>
      <div className={splash ? "splash-copy" : undefined}>
      <p className="note">Ask &quot;Me&quot;</p>
      <h1>{title}</h1>
      <p>{purpose}</p>
      {notes.length > 0 ? (
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      </div>
      {children}
      {actions.length > 0 ? (
        <div className={splash ? "actions splash-actions" : "actions"}>
          {actions.map((action) => (
            <Link key={action.href} className={action.secondary ? "button secondary" : "button"} href={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
      {showLogoSlot ? <p className="logo-slot">Logo 尚未提供</p> : null}
    </main>
  );
}
