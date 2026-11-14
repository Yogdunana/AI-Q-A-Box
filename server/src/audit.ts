import type { DatabaseSync } from "node:sqlite";
import { newId } from "./crypto.ts";

const FORBIDDEN_KEY = /content|password|email|token|secret|prompt|output|notes|authorization|cookie/i;

export interface AuditInput {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

/** Audit rows stay short and structural. Question text, prompts, and secrets never belong here. */
export function writeAudit(db: DatabaseSync, input: AuditInput): void {
  const metadata = input.metadata ?? {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY.test(key)) throw new Error("Refusing to write sensitive audit metadata");
    if (typeof value === "string" && value.length > 80) throw new Error("Refusing to write a long audit value");
  }
  db.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId(), input.actorId, input.action, input.resourceType, input.resourceId, JSON.stringify(metadata), input.createdAt);
}
