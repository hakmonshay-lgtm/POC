import { nanoid } from "nanoid";
import { getDb, dbNowIso } from "@/lib/db";

type AiSuggestRequest = {
  prompt: string;
  screen: string;
  context?: Record<string, unknown>;
};

function heuristicSuggest(req: AiSuggestRequest) {
  const p = (req.prompt || "").toLowerCase();

  if (req.screen === "general") {
    const season = p.includes("q1") ? "Q1" : p.includes("holiday") ? "Holiday" : "Campaign";
    const name = req.context?.goal ? `${season}: ${String(req.context.goal)}` : `${season}: Retention Boost`;
    const today = new Date();
    const start = new Date(today.getTime() + 3 * 86400000);
    const end = new Date(today.getTime() + 33 * 86400000);
    return {
      suggestions: {
        name,
        description: "Target high-propensity customers with a clear action + benefit, using consent-aware channels and a Legal-approved template set.",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        priority: 4,
        arbitrationWeight: 1.2,
      },
      reasonCodes: [
        { code: "FATIGUE_BUFFER", detail: "Start date set ~3 days out to allow scheduling and avoid same-day fatigue." },
        { code: "WINDOW_30D", detail: "A 30-day window balances reach with operational and legal review cadence." },
      ],
    };
  }

  if (req.screen === "audience") {
    return {
      suggestions: {
        rules: {
          kind: "group",
          op: "AND",
          rules: [
            { kind: "condition", field: "consent_email", op: "=", value: true },
            { kind: "condition", field: "risk_flag", op: "=", value: false },
            { kind: "condition", field: "purchases_12mo", op: ">=", value: 2 },
          ],
        },
        fairnessScan: { score: 0.92, notes: ["Rules avoid explicit sensitive attributes (none modeled in this MVP)."] },
      },
      reasonCodes: [
        { code: "CONSENT_AWARE", detail: "Includes consent_email to ensure deliverability and compliance." },
        { code: "LOW_RISK", detail: "Excludes risk-flagged customers to reduce complaint/churn risk." },
      ],
    };
  }

  if (req.screen === "action") {
    return {
      suggestions: {
        options: [
          { type: "complete_profile", completionEvent: "profile.completed", confidence: 0.78, friction: "Low" },
          { type: "enroll_abp", completionEvent: "abp.enrolled", confidence: 0.64, friction: "Medium" },
          { type: "purchase_sku", completionEvent: "order.completed", confidence: 0.51, friction: "High" },
        ],
      },
      reasonCodes: [{ code: "FRICTION_MODEL", detail: "Profile completion typically has lowest friction and fastest time-to-complete." }],
    };
  }

  if (req.screen === "benefit") {
    return {
      suggestions: {
        liability: { expected: 18000, p95: 42000, capRecommendation: 50000 },
        notes: ["Consider lower cap or narrower audience if liability risk exceeds threshold."],
      },
      reasonCodes: [{ code: "LIABILITY_SIM", detail: "Uses heuristic redemption rates for this MVP (not production-calibrated)." }],
    };
  }

  if (req.screen === "comms") {
    const sms = "Hi {{first name}}, complete your profile to unlock your offer. Tap to finish: {{cta_url}} Reply STOP to opt out.";
    const emailSubject = "Complete your profile and unlock your offer";
    const emailBody =
      "Hi {{first name}},\n\nComplete your profile to unlock your benefit. It takes about 2 minutes.\n\nCTA: {{cta_url}}\n\nYou can manage your preferences in your account settings.";
    const memo = "Customer completed profile offer presented; follow redemption steps per NBA policy.";
    return {
      suggestions: {
        templates: [
          { channel: "SMS", subject: "", body: sms },
          { channel: "Email", subject: emailSubject, body: emailBody },
          { channel: "Memo", subject: "", body: memo },
        ],
        compliance: {
          risk: "Low",
          findings: [
            { type: "TCPA", detail: "Includes STOP opt-out language for SMS." },
            { type: "TOKENS", detail: "Uses {{first name}} and {{cta_url}}; ensure fallbacks for missing first name." },
          ],
        },
      },
      reasonCodes: [{ code: "CHANNEL_FALLBACK", detail: "Email fallback helps reach customers without SMS consent." }],
    };
  }

  if (req.screen === "summary") {
    return {
      suggestions: {
        readinessScore: 86,
        risks: [{ code: "TOKEN_FALLBACK", detail: "Provide fallback when {{first name}} is missing." }],
        execSummary:
          "This NBA targets consented, low-risk customers with demonstrated purchase engagement and prompts a low-friction action with a capped benefit. Communications are routed through consent-aware channels and gated by Legal approval prior to activation.",
      },
      reasonCodes: [{ code: "CHECKLIST", detail: "Readiness is derived from validations + missing fields + legal state." }],
    };
  }

  return { suggestions: {}, reasonCodes: [] };
}

export function aiSuggest(req: AiSuggestRequest) {
  const outputs = heuristicSuggest(req);
  const db = getDb();
  db.prepare(
    `
    INSERT INTO ai_artifact (id, prompt_id, screen, model_version, inputs_json, outputs_json, confidence, guardrail_flags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    nanoid(),
    nanoid(),
    req.screen,
    "heuristic-mvp-1",
    JSON.stringify(req),
    JSON.stringify(outputs),
    0.7,
    JSON.stringify([]),
    dbNowIso(),
  );
  return outputs;
}

