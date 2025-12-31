import type { AudienceRules, RuleCondition } from "@/lib/domain";

export type CustomerRow = {
  id: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  consent_sms: number;
  consent_email: number;
  risk_flag: number;
  plan: string;
  tenure_months: number;
  purchases_12mo: number;
  complaints_12mo: number;
  last_activity_at: string;
};

function getFieldValue(c: CustomerRow, field: RuleCondition["field"]) {
  switch (field) {
    case "plan":
      return c.plan;
    case "tenure_months":
      return c.tenure_months;
    case "purchases_12mo":
      return c.purchases_12mo;
    case "complaints_12mo":
      return c.complaints_12mo;
    case "risk_flag":
      return Boolean(c.risk_flag);
    case "consent_sms":
      return Boolean(c.consent_sms);
    case "consent_email":
      return Boolean(c.consent_email);
  }
}

function evalCondition(c: CustomerRow, cond: RuleCondition): boolean {
  const fieldVal = getFieldValue(c, cond.field);
  const op = cond.op;
  const v = cond.value as unknown;

  if (op === "in") {
    const arr = Array.isArray(v) ? v : [v];
    return arr.some((x) => x === fieldVal);
  }

  if (typeof fieldVal === "string") {
    if (typeof v !== "string") return false;
    if (op === "=") return fieldVal === v;
    if (op === "!=") return fieldVal !== v;
    return false;
  }

  if (typeof fieldVal === "boolean") {
    const vb = typeof v === "boolean" ? v : v === "true";
    if (op === "=") return fieldVal === vb;
    if (op === "!=") return fieldVal !== vb;
    return false;
  }

  const vn = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(vn)) return false;
  if (op === "=") return fieldVal === vn;
  if (op === "!=") return fieldVal !== vn;
  if (op === ">") return fieldVal > vn;
  if (op === ">=") return fieldVal >= vn;
  if (op === "<") return fieldVal < vn;
  if (op === "<=") return fieldVal <= vn;
  return false;
}

export function evalAudienceRules(c: CustomerRow, rules: AudienceRules): boolean {
  const results = rules.rules.map((r) => {
    if (r.kind === "condition") return evalCondition(c, r);
    return evalAudienceRules(c, r);
  });
  if (rules.op === "AND") return results.every(Boolean);
  return results.some(Boolean);
}

