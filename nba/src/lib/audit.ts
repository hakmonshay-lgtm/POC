import { diffJson } from "diff";
import { nanoid } from "nanoid";
import { getDb, dbNowIso } from "@/lib/db";
import type { Role } from "@/lib/domain";

export type AuditEntityType = "NBA" | "Audience" | "Action" | "Benefit" | "CommTemplate" | "LegalApproval";

export function computeJsonDiff(before: unknown, after: unknown) {
  const b = typeof before === "object" && before !== null ? before : { value: before };
  const a = typeof after === "object" && after !== null ? after : { value: after };
  return diffJson(b, a);
}

export function writeAuditLog(params: {
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  const db = getDb();
  const parts = computeJsonDiff(params.before, params.after);
  db.prepare(
    `
    INSERT INTO audit_log (id, actor_id, actor_role, action, entity_type, entity_id, diff_json, created_at)
    VALUES (@id, @actor_id, @actor_role, @action, @entity_type, @entity_id, @diff_json, @created_at)
  `,
  ).run({
    id: nanoid(),
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    diff_json: JSON.stringify(parts),
    created_at: dbNowIso(),
  });
}

