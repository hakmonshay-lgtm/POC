import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

declare global {
  var __nbaDb: Database.Database | undefined;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function initSchema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS nba (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 5,
      arbitration_weight REAL NOT NULL DEFAULT 1.0,
      current_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nba_version (
      id TEXT PRIMARY KEY,
      nba_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      material_change INTEGER NOT NULL DEFAULT 0,
      change_summary TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (nba_id, version),
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audience (
      id TEXT PRIMARY KEY,
      nba_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      rules_json TEXT NOT NULL,
      size_estimate INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE (nba_id, version),
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS action_def (
      id TEXT PRIMARY KEY,
      nba_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      type TEXT NOT NULL,
      completion_event TEXT NOT NULL,
      sale_channels_json TEXT NOT NULL,
      offer_priority INTEGER NOT NULL DEFAULT 5,
      max_offers_per_customer INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      UNIQUE (nba_id, version),
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS benefit (
      id TEXT PRIMARY KEY,
      nba_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      type TEXT NOT NULL,
      value_number REAL NOT NULL,
      value_unit TEXT NOT NULL,
      cap_number REAL NOT NULL,
      threshold_json TEXT NOT NULL,
      stackability_json TEXT NOT NULL,
      exclusions_json TEXT NOT NULL,
      redemption_logic TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (nba_id, version),
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comm_template (
      id TEXT PRIMARY KEY,
      nba_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      tokens_json TEXT NOT NULL,
      legal_status TEXT NOT NULL,
      legal_reviewer_id TEXT,
      legal_notes TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (nba_id, version, channel),
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS legal_approval (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      comments TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      diff_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      email TEXT,
      phone TEXT,
      consent_sms INTEGER NOT NULL DEFAULT 0,
      consent_email INTEGER NOT NULL DEFAULT 0,
      risk_flag INTEGER NOT NULL DEFAULT 0,
      plan TEXT NOT NULL,
      tenure_months INTEGER NOT NULL,
      purchases_12mo INTEGER NOT NULL,
      complaints_12mo INTEGER NOT NULL,
      last_activity_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offer_assignment (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      nba_id TEXT NOT NULL,
      nba_version INTEGER NOT NULL,
      status TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      redeemed_at TEXT,
      channel TEXT,
      FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS arbitration_score (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      nba_id TEXT NOT NULL,
      nba_version INTEGER NOT NULL,
      score REAL NOT NULL,
      factors_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
      FOREIGN KEY (nba_id) REFERENCES nba(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_artifact (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      screen TEXT NOT NULL,
      model_version TEXT NOT NULL,
      inputs_json TEXT NOT NULL,
      outputs_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      guardrail_flags_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function seed(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(1) as c FROM customer").get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(`
    INSERT INTO customer (
      id, first_name, email, phone, consent_sms, consent_email, risk_flag,
      plan, tenure_months, purchases_12mo, complaints_12mo, last_activity_at
    ) VALUES (
      @id, @first_name, @email, @phone, @consent_sms, @consent_email, @risk_flag,
      @plan, @tenure_months, @purchases_12mo, @complaints_12mo, @last_activity_at
    )
  `);

  const plans = ["Basic", "Plus", "Unlimited"];
  const firstNames = ["Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Avery"];
  const now = Date.now();
  const tx = db.transaction(() => {
    for (let i = 1; i <= 40; i++) {
      const first = firstNames[i % firstNames.length]!;
      const plan = plans[i % plans.length]!;
      const tenure = 2 + (i * 3) % 48;
      const purchases = (i * 7) % 6;
      const complaints = (i * 5) % 3;
      const risk = complaints >= 2 ? 1 : 0;
      const consentSms = i % 2 === 0 ? 1 : 0;
      const consentEmail = 1;
      insert.run({
        id: `CUST-${i.toString().padStart(4, "0")}`,
        first_name: first,
        email: `${first.toLowerCase()}${i}@example.com`,
        phone: `+1555000${i.toString().padStart(4, "0")}`,
        consent_sms: consentSms,
        consent_email: consentEmail,
        risk_flag: risk,
        plan,
        tenure_months: tenure,
        purchases_12mo: purchases,
        complaints_12mo: complaints,
        last_activity_at: new Date(now - i * 86400000).toISOString(),
      });
    }
  });
  tx();
}

export function getDb() {
  if (global.__nbaDb) return global.__nbaDb;

  const dataDir = path.join(process.cwd(), "data");
  ensureDir(dataDir);
  const dbPath = path.join(dataDir, "nba.db");
  const db = new Database(dbPath);
  initSchema(db);
  seed(db);

  global.__nbaDb = db;
  return db;
}

export function dbNowIso() {
  return nowIso();
}

