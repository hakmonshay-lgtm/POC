import { nanoid } from "nanoid";
import { getDb, dbNowIso } from "@/lib/db";
import type { AudienceRules } from "@/lib/domain";
import { NbaGeneralSchema, assertStartBeforeEnd, ActionSchema, BenefitSchema, CommsSchema } from "@/lib/domain";
import { evalAudienceRules, type CustomerRow } from "@/lib/audience";
import { writeAuditLog } from "@/lib/audit";
import type { Session } from "@/lib/session";

export type NbaRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  owner_id: string;
  priority: number;
  arbitration_weight: number;
  current_version: number;
  created_at: string;
  updated_at: string;
};

export function listNbas() {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT id, name, description, start_date, end_date, status, owner_id, priority, arbitration_weight, current_version, created_at, updated_at
      FROM nba
      ORDER BY updated_at DESC
    `,
    )
    .all() as NbaRow[];
}

export function getNbaById(id: string) {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT id, name, description, start_date, end_date, status, owner_id, priority, arbitration_weight, current_version, created_at, updated_at
      FROM nba WHERE id = ?
    `,
    )
    .get(id) as NbaRow | undefined;
}

export function getLatestSnapshot(nbaId: string) {
  const nba = getNbaById(nbaId);
  if (!nba) return null;
  return buildSnapshot(nbaId, nba.current_version);
}

export function buildSnapshot(nbaId: string, version: number) {
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) return null;
  const audience = db.prepare("SELECT rules_json, size_estimate, updated_at FROM audience WHERE nba_id=? AND version=?").get(nbaId, version) as
    | { rules_json: string; size_estimate: number; updated_at: string }
    | undefined;
  const action = db
    .prepare(
      "SELECT type, completion_event, sale_channels_json, offer_priority, max_offers_per_customer, updated_at FROM action_def WHERE nba_id=? AND version=?",
    )
    .get(nbaId, version) as
    | {
        type: string;
        completion_event: string;
        sale_channels_json: string;
        offer_priority: number;
        max_offers_per_customer: number;
        updated_at: string;
      }
    | undefined;
  const benefit = db
    .prepare(
      "SELECT type, value_number, value_unit, cap_number, threshold_json, stackability_json, exclusions_json, redemption_logic, description, updated_at FROM benefit WHERE nba_id=? AND version=?",
    )
    .get(nbaId, version) as
    | {
        type: string;
        value_number: number;
        value_unit: string;
        cap_number: number;
        threshold_json: string;
        stackability_json: string;
        exclusions_json: string;
        redemption_logic: string;
        description: string;
        updated_at: string;
      }
    | undefined;
  const comms = db
    .prepare(
      "SELECT channel, subject, body, tokens_json, legal_status, legal_reviewer_id, legal_notes, updated_at FROM comm_template WHERE nba_id=? AND version=? ORDER BY channel ASC",
    )
    .all(nbaId, version) as Array<{
    channel: string;
    subject: string | null;
    body: string;
    tokens_json: string;
    legal_status: string;
    legal_reviewer_id: string | null;
    legal_notes: string | null;
    updated_at: string;
  }>;

  return {
    nba,
    version,
    audience: audience
      ? { rules: JSON.parse(audience.rules_json) as AudienceRules, sizeEstimate: audience.size_estimate, updatedAt: audience.updated_at }
      : null,
    action: action
      ? {
          type: action.type,
          completionEvent: action.completion_event,
          saleChannels: JSON.parse(action.sale_channels_json) as string[],
          offerPriority: action.offer_priority,
          maxOffersPerCustomer: action.max_offers_per_customer,
          updatedAt: action.updated_at,
        }
      : null,
    benefit: benefit
      ? {
          type: benefit.type,
          valueNumber: benefit.value_number,
          valueUnit: benefit.value_unit,
          capNumber: benefit.cap_number,
          threshold: JSON.parse(benefit.threshold_json),
          stackability: JSON.parse(benefit.stackability_json),
          exclusions: JSON.parse(benefit.exclusions_json),
          redemptionLogic: benefit.redemption_logic,
          description: benefit.description,
          updatedAt: benefit.updated_at,
        }
      : null,
    comms: comms.map((t) => ({
      channel: t.channel,
      subject: t.subject ?? "",
      body: t.body,
      tokens: JSON.parse(t.tokens_json) as string[],
      legalStatus: t.legal_status,
      legalReviewerId: t.legal_reviewer_id,
      legalNotes: t.legal_notes ?? "",
      updatedAt: t.updated_at,
    })),
  };
}

function isMaterialChangeForApproved(fieldGroup: "general" | "audience" | "action" | "benefit" | "comms") {
  // For this MVP: any non-general update is material; general updates are material if dates/name change.
  return fieldGroup !== "general";
}

function bumpVersionIfNeeded(nba: NbaRow, session: Session, fieldGroup: "general" | "audience" | "action" | "benefit" | "comms") {
  const material = nba.status !== "Draft" && isMaterialChangeForApproved(fieldGroup);
  if (!material) return nba.current_version;

  const db = getDb();
  const nextVersion = nba.current_version + 1;
  db.prepare("UPDATE nba SET current_version=?, status=?, updated_at=? WHERE id=?").run(nextVersion, "In Legal Review", dbNowIso(), nba.id);

  // Copy forward existing versioned rows to the new version.
  db.prepare("INSERT OR IGNORE INTO audience (id, nba_id, version, rules_json, size_estimate, updated_at) SELECT ?, nba_id, ?, rules_json, size_estimate, ? FROM audience WHERE nba_id=? AND version=?").run(
    nanoid(),
    nextVersion,
    dbNowIso(),
    nba.id,
    nba.current_version,
  );
  db.prepare(
    "INSERT OR IGNORE INTO action_def (id, nba_id, version, type, completion_event, sale_channels_json, offer_priority, max_offers_per_customer, updated_at) SELECT ?, nba_id, ?, type, completion_event, sale_channels_json, offer_priority, max_offers_per_customer, ? FROM action_def WHERE nba_id=? AND version=?",
  ).run(nanoid(), nextVersion, dbNowIso(), nba.id, nba.current_version);
  db.prepare(
    "INSERT OR IGNORE INTO benefit (id, nba_id, version, type, value_number, value_unit, cap_number, threshold_json, stackability_json, exclusions_json, redemption_logic, description, updated_at) SELECT ?, nba_id, ?, type, value_number, value_unit, cap_number, threshold_json, stackability_json, exclusions_json, redemption_logic, description, ? FROM benefit WHERE nba_id=? AND version=?",
  ).run(nanoid(), nextVersion, dbNowIso(), nba.id, nba.current_version);
  db.prepare(
    "INSERT OR IGNORE INTO comm_template (id, nba_id, version, channel, subject, body, tokens_json, legal_status, legal_reviewer_id, legal_notes, updated_at) SELECT ?, nba_id, ?, channel, subject, body, tokens_json, 'In Review', legal_reviewer_id, legal_notes, ? FROM comm_template WHERE nba_id=? AND version=?",
  ).run(nanoid(), nextVersion, dbNowIso(), nba.id, nba.current_version);

  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "VERSION_BUMP",
    entityType: "NBA",
    entityId: nba.id,
    before: { currentVersion: nba.current_version, status: nba.status },
    after: { currentVersion: nextVersion, status: "In Legal Review" },
  });
  return nextVersion;
}

export function createNba(input: unknown, session: Session) {
  const parsed = NbaGeneralSchema.parse(input);
  assertStartBeforeEnd(parsed.startDate, parsed.endDate);

  const db = getDb();
  const id = nanoid();
  const now = dbNowIso();
  const nba: NbaRow = {
    id,
    name: parsed.name,
    description: parsed.description ?? "",
    start_date: parsed.startDate,
    end_date: parsed.endDate,
    status: "Draft",
    owner_id: session.userId,
    priority: parsed.priority,
    arbitration_weight: parsed.arbitrationWeight,
    current_version: 1,
    created_at: now,
    updated_at: now,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO nba (id, name, description, start_date, end_date, status, owner_id, priority, arbitration_weight, current_version, created_at, updated_at)
      VALUES (@id, @name, @description, @start_date, @end_date, @status, @owner_id, @priority, @arbitration_weight, @current_version, @created_at, @updated_at)
    `,
    ).run(nba);

    const snapshot = buildSnapshot(id, 1) ?? { nba, version: 1, audience: null, action: null, benefit: null, comms: [] };
    db.prepare(
      `
      INSERT INTO nba_version (id, nba_id, version, snapshot_json, material_change, change_summary, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(nanoid(), id, 1, JSON.stringify(snapshot), 0, "Initial draft", session.userId, now);

    writeAuditLog({
      actorId: session.userId,
      actorRole: session.role,
      action: "CREATE_NBA",
      entityType: "NBA",
      entityId: id,
      before: null,
      after: nba,
    });
  });

  tx();
  return nba;
}

export function updateGeneral(nbaId: string, input: unknown, session: Session) {
  const parsed = NbaGeneralSchema.parse(input);
  assertStartBeforeEnd(parsed.startDate, parsed.endDate);

  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");

  const before = { ...nba };
  const nextVersion = bumpVersionIfNeeded(nba, session, "general");

  db.prepare(
    `
    UPDATE nba
    SET name=?, description=?, start_date=?, end_date=?, priority=?, arbitration_weight=?, updated_at=?
    WHERE id=?
  `,
  ).run(parsed.name, parsed.description ?? "", parsed.startDate, parsed.endDate, parsed.priority, parsed.arbitrationWeight, dbNowIso(), nbaId);

  const after = getNbaById(nbaId);
  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "UPDATE_GENERAL",
    entityType: "NBA",
    entityId: nbaId,
    before,
    after,
  });

  return { nba: after, version: nextVersion };
}

export function upsertAudience(nbaId: string, rulesInput: unknown, session: Session) {
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");

  const rules = rulesInput as AudienceRules;
  const version = bumpVersionIfNeeded(nba, session, "audience");

  const customers = db.prepare("SELECT * FROM customer").all() as CustomerRow[];
  const eligible = customers.filter((c) => evalAudienceRules(c, rules));

  const existing = db.prepare("SELECT id, rules_json, size_estimate FROM audience WHERE nba_id=? AND version=?").get(nbaId, version) as
    | { id: string; rules_json: string; size_estimate: number }
    | undefined;

  const now = dbNowIso();
  if (existing) {
    db.prepare("UPDATE audience SET rules_json=?, size_estimate=?, updated_at=? WHERE id=?").run(
      JSON.stringify(rules),
      eligible.length,
      now,
      existing.id,
    );
  } else {
    db.prepare("INSERT INTO audience (id, nba_id, version, rules_json, size_estimate, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      nanoid(),
      nbaId,
      version,
      JSON.stringify(rules),
      eligible.length,
      now,
    );
  }

  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "UPSERT_AUDIENCE",
    entityType: "Audience",
    entityId: `${nbaId}@v${version}`,
    before: existing ? JSON.parse(existing.rules_json) : null,
    after: rules,
  });

  return { version, sizeEstimate: eligible.length, sampleCustomerIds: eligible.slice(0, 20).map((c) => c.id) };
}

export function upsertAction(nbaId: string, actionInput: unknown, session: Session) {
  const parsed = ActionSchema.parse(actionInput);
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");

  const version = bumpVersionIfNeeded(nba, session, "action");
  const existing = db.prepare("SELECT id, type, completion_event, sale_channels_json, offer_priority, max_offers_per_customer FROM action_def WHERE nba_id=? AND version=?").get(
    nbaId,
    version,
  ) as
    | {
        id: string;
        type: string;
        completion_event: string;
        sale_channels_json: string;
        offer_priority: number;
        max_offers_per_customer: number;
      }
    | undefined;

  const now = dbNowIso();
  if (existing) {
    db.prepare(
      "UPDATE action_def SET type=?, completion_event=?, sale_channels_json=?, offer_priority=?, max_offers_per_customer=?, updated_at=? WHERE id=?",
    ).run(
      parsed.type,
      parsed.completionEvent,
      JSON.stringify(parsed.saleChannels),
      parsed.offerPriority,
      parsed.maxOffersPerCustomer,
      now,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO action_def (id, nba_id, version, type, completion_event, sale_channels_json, offer_priority, max_offers_per_customer, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      nanoid(),
      nbaId,
      version,
      parsed.type,
      parsed.completionEvent,
      JSON.stringify(parsed.saleChannels),
      parsed.offerPriority,
      parsed.maxOffersPerCustomer,
      now,
    );
  }

  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "UPSERT_ACTION",
    entityType: "Action",
    entityId: `${nbaId}@v${version}`,
    before: existing
      ? {
          type: existing.type,
          completionEvent: existing.completion_event,
          saleChannels: JSON.parse(existing.sale_channels_json),
          offerPriority: existing.offer_priority,
          maxOffersPerCustomer: existing.max_offers_per_customer,
        }
      : null,
    after: parsed,
  });

  return { version };
}

export function upsertBenefit(nbaId: string, benefitInput: unknown, session: Session) {
  const parsed = BenefitSchema.parse(benefitInput);
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");

  const version = bumpVersionIfNeeded(nba, session, "benefit");
  const existing = db.prepare("SELECT id, type, value_number, value_unit, cap_number, threshold_json, stackability_json, exclusions_json, redemption_logic, description FROM benefit WHERE nba_id=? AND version=?").get(
    nbaId,
    version,
  ) as
    | {
        id: string;
        type: string;
        value_number: number;
        value_unit: string;
        cap_number: number;
        threshold_json: string;
        stackability_json: string;
        exclusions_json: string;
        redemption_logic: string;
        description: string;
      }
    | undefined;

  const now = dbNowIso();
  if (existing) {
    db.prepare(
      "UPDATE benefit SET type=?, value_number=?, value_unit=?, cap_number=?, threshold_json=?, stackability_json=?, exclusions_json=?, redemption_logic=?, description=?, updated_at=? WHERE id=?",
    ).run(
      parsed.type,
      parsed.valueNumber,
      parsed.valueUnit,
      parsed.capNumber,
      JSON.stringify(parsed.threshold),
      JSON.stringify(parsed.stackability),
      JSON.stringify(parsed.exclusions),
      parsed.redemptionLogic,
      parsed.description,
      now,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO benefit (id, nba_id, version, type, value_number, value_unit, cap_number, threshold_json, stackability_json, exclusions_json, redemption_logic, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      nanoid(),
      nbaId,
      version,
      parsed.type,
      parsed.valueNumber,
      parsed.valueUnit,
      parsed.capNumber,
      JSON.stringify(parsed.threshold),
      JSON.stringify(parsed.stackability),
      JSON.stringify(parsed.exclusions),
      parsed.redemptionLogic,
      parsed.description,
      now,
    );
  }

  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "UPSERT_BENEFIT",
    entityType: "Benefit",
    entityId: `${nbaId}@v${version}`,
    before: existing
      ? {
          type: existing.type,
          valueNumber: existing.value_number,
          valueUnit: existing.value_unit,
          capNumber: existing.cap_number,
          threshold: JSON.parse(existing.threshold_json),
          stackability: JSON.parse(existing.stackability_json),
          exclusions: JSON.parse(existing.exclusions_json),
          redemptionLogic: existing.redemption_logic,
          description: existing.description,
        }
      : null,
    after: parsed,
  });

  return { version };
}

function extractTokens(text: string) {
  const re = /\{\{\s*([a-zA-Z0-9_ ]+)\s*\}\}/g;
  const tokens = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tokens.add(m[1]!.trim());
  return Array.from(tokens).sort();
}

export function upsertComms(nbaId: string, commsInput: unknown, session: Session) {
  const parsed = CommsSchema.parse(commsInput);
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");

  const version = bumpVersionIfNeeded(nba, session, "comms");
  const now = dbNowIso();

  const tx = db.transaction(() => {
    for (const ch of parsed.channels) {
      const tpl = parsed.templates.find((t) => t.channel === ch);
      if (!tpl) continue;
      const tokens = extractTokens(`${tpl.subject ?? ""}\n${tpl.body}`);
      const existing = db
        .prepare("SELECT id, subject, body, tokens_json, legal_status, legal_reviewer_id, legal_notes FROM comm_template WHERE nba_id=? AND version=? AND channel=?")
        .get(nbaId, version, ch) as
        | {
            id: string;
            subject: string | null;
            body: string;
            tokens_json: string;
            legal_status: string;
            legal_reviewer_id: string | null;
            legal_notes: string | null;
          }
        | undefined;

      const legalStatus = "In Review"; // gate all customer-facing messaging
      if (existing) {
        db.prepare(
          "UPDATE comm_template SET subject=?, body=?, tokens_json=?, legal_status=?, legal_reviewer_id=?, legal_notes=?, updated_at=? WHERE id=?",
        ).run(
          tpl.subject ?? "",
          tpl.body,
          JSON.stringify(tokens),
          legalStatus,
          parsed.legalReviewerId ?? existing.legal_reviewer_id,
          parsed.legalNotes ?? existing.legal_notes ?? "",
          now,
          existing.id,
        );
        writeAuditLog({
          actorId: session.userId,
          actorRole: session.role,
          action: "UPSERT_TEMPLATE",
          entityType: "CommTemplate",
          entityId: existing.id,
          before: existing,
          after: { channel: ch, subject: tpl.subject ?? "", body: tpl.body, tokens, legalStatus, legalReviewerId: parsed.legalReviewerId, legalNotes: parsed.legalNotes },
        });
      } else {
        const id = nanoid();
        db.prepare(
          "INSERT INTO comm_template (id, nba_id, version, channel, subject, body, tokens_json, legal_status, legal_reviewer_id, legal_notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          id,
          nbaId,
          version,
          ch,
          tpl.subject ?? "",
          tpl.body,
          JSON.stringify(tokens),
          legalStatus,
          parsed.legalReviewerId ?? null,
          parsed.legalNotes ?? "",
          now,
        );
        writeAuditLog({
          actorId: session.userId,
          actorRole: session.role,
          action: "CREATE_TEMPLATE",
          entityType: "CommTemplate",
          entityId: id,
          before: null,
          after: { channel: ch, subject: tpl.subject ?? "", body: tpl.body, tokens, legalStatus, legalReviewerId: parsed.legalReviewerId, legalNotes: parsed.legalNotes },
        });
      }
    }
  });

  tx();
  return { version };
}

export function listAuditForEntity(entityType: string, entityId: string) {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT id, actor_id, actor_role, action, entity_type, entity_id, diff_json, created_at
      FROM audit_log
      WHERE entity_type=? AND entity_id=?
      ORDER BY created_at DESC
    `,
    )
    .all(entityType, entityId) as Array<{
    id: string;
    actor_id: string;
    actor_role: string;
    action: string;
    entity_type: string;
    entity_id: string;
    diff_json: string;
    created_at: string;
  }>;
}

export function listLegalInbox() {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT t.id, t.nba_id, t.version, t.channel, t.subject, t.body, t.tokens_json, t.legal_status, t.legal_reviewer_id, t.legal_notes, t.updated_at,
             n.name as nba_name
      FROM comm_template t
      JOIN nba n ON n.id = t.nba_id
      WHERE t.legal_status IN ('In Review', 'Rejected')
      ORDER BY t.updated_at DESC
    `,
    )
    .all() as Array<{
    id: string;
    nba_id: string;
    version: number;
    channel: string;
    subject: string;
    body: string;
    tokens_json: string;
    legal_status: string;
    legal_reviewer_id: string | null;
    legal_notes: string | null;
    updated_at: string;
    nba_name: string;
  }>;
}

export function legalDecision(templateId: string, decision: "Approved" | "Rejected", comments: string, session: Session) {
  const db = getDb();
  const tpl = db.prepare("SELECT * FROM comm_template WHERE id=?").get(templateId) as
    | {
        id: string;
        nba_id: string;
        version: number;
        channel: string;
        subject: string | null;
        body: string;
        tokens_json: string;
        legal_status: string;
        legal_reviewer_id: string | null;
        legal_notes: string | null;
        updated_at: string;
      }
    | undefined;
  if (!tpl) throw new Error("Template not found");
  const before = { ...tpl };
  const now = dbNowIso();
  db.prepare("UPDATE comm_template SET legal_status=?, legal_reviewer_id=?, legal_notes=?, updated_at=? WHERE id=?").run(
    decision,
    session.userId,
    comments,
    now,
    templateId,
  );
  db.prepare("INSERT INTO legal_approval (id, entity_type, entity_id, reviewer_id, status, comments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    nanoid(),
    "CommTemplate",
    templateId,
    session.userId,
    decision,
    comments,
    now,
  );

  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: `LEGAL_${decision.toUpperCase()}`,
    entityType: "LegalApproval",
    entityId: templateId,
    before,
    after: { ...before, legal_status: decision, legal_reviewer_id: session.userId, legal_notes: comments, updated_at: now },
  });
}

export function transitionNba(nbaId: string, nextStatus: string, session: Session) {
  const db = getDb();
  const nba = getNbaById(nbaId);
  if (!nba) throw new Error("NBA not found");
  const before = { status: nba.status };
  db.prepare("UPDATE nba SET status=?, updated_at=? WHERE id=?").run(nextStatus, dbNowIso(), nbaId);
  writeAuditLog({
    actorId: session.userId,
    actorRole: session.role,
    action: "STATUS_TRANSITION",
    entityType: "NBA",
    entityId: nbaId,
    before,
    after: { status: nextStatus },
  });
}

