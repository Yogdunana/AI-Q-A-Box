import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

export function migrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../migrations");
}

export function migrate(db: DatabaseSync, directory = migrationsDir()): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const appliedRows = db.prepare("SELECT id FROM schema_migrations").all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const fresh: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(directory, file), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
      db.exec("COMMIT");
      fresh.push(file);
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // See withTransaction.
      }
      throw error;
    }
  }
  return fresh;
}
