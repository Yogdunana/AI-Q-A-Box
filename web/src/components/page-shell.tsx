import Link from "next/link";

type PageShellProps = {
  title: string;
  purpose: string;
  notes?: string[];
  actions?: { href: string; label: string; secondary?: boolean }[];
  showLogoSlot?: boolean;
};

export function PageShell({ title, purpose, notes = [], actions = [], showLogoSlot = false }: PageShellProps) {
  return (
    <main className="shell">
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
      {actions.length > 0 ? (
        <div className="actions">
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
