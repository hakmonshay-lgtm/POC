"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function stubModel(screen: string, prompt: string) {
  const p = prompt.toLowerCase();

  if (screen === "general") {
    const name =
      p.includes("q1") || p.includes("retention")
        ? "Q1 Retention: Keep Payments Current"
        : "Customer Experience: Next Best Action";
    return {
      message: `Suggested NBA name: “${name}”.\nRecommended window: start next Tuesday, run 4–6 weeks to balance lift vs. fatigue.`,
      reasonCodes: ["HISTORICAL_LIFT_WINDOW", "FATIGUE_GUARDRAIL", "SEASONALITY_MATCH"],
      confidence: 0.82,
      guardrailFlags: [],
    };
  }

  if (screen === "audience") {
    return {
      message:
        "Draft audience: tenure ≥ 3 months AND purchases12mo ≥ 2 AND consentSms=true.\nExclude: HIGH_COMPLAINT_RISK, do-not-contact, recent churn signals.\nFairness scan: OK (no high disparate impact detected in MVP stub).",
      reasonCodes: ["KPI_ALIGNMENT", "CONSENT_AWARE", "RISK_SUPPRESSION"],
      confidence: 0.76,
      guardrailFlags: ["FAIRNESS_SCAN_STUB"],
    };
  }

  if (screen === "action") {
    return {
      message:
        "Top actions (MVP stub):\n1) Update Payment Profile (highest near-term completion)\n2) Enroll for Auto-bill Pay\n3) Complete Profile\nSuggested reminder cadence: 3 touches over 14 days (Day 0 / 7 / 12).",
      reasonCodes: ["LOW_FRICTION", "HIGH_COMPLETION_14D", "OPERATIONAL_FEASIBILITY"],
      confidence: 0.71,
      guardrailFlags: [],
    };
  }

  if (screen === "benefit") {
    return {
      message:
        "Liability quick-sim (stub):\n- 10% off → higher variance; cap needed.\n- $10 one-time credit → predictable cost.\nRecommendation: $10 one-time credit with total liability cap $50k and exclude stacked holiday promos.",
      reasonCodes: ["LIABILITY_CONTROL", "PREDICTABILITY", "STACKABILITY_RISK"],
      confidence: 0.68,
      guardrailFlags: ["LIABILITY_SIM_STUB"],
    };
  }

  if (screen === "comms") {
    const sms =
      "Hi {{firstName}}—your card on file may expire soon. Update now to avoid service interruption: {{shortUrl}}. Reply STOP to opt out.";
    return {
      message: `Draft TCPA-friendly SMS (≤160 chars target):\n${sms}\n\nTokens validated: {{firstName}}, {{shortUrl}} (fallback required if missing).`,
      reasonCodes: ["READING_LEVEL_SIMPLE", "TCPA_OPT_OUT", "TOKEN_VALIDATION"],
      confidence: 0.79,
      guardrailFlags: ["COMPLIANCE_SCAN_STUB"],
    };
  }

  return {
    message:
      "Readiness score (stub): 86/100. Suggestion: add Email fallback, confirm cap, and ensure Legal reviewer assigned before submission.",
    reasonCodes: ["READINESS_CHECKLIST", "CHANNEL_FALLBACK", "LEGAL_GATE"],
    confidence: 0.74,
    guardrailFlags: ["OUTCOME_PREDICTION_STUB"],
  };
}

export async function runAiAssistant(args: { nbaVersionId: string; screen: string; prompt: string }) {
  const user = await getCurrentUser();
  const { nbaVersionId, screen, prompt } = args;

  const output = stubModel(screen, prompt);

  await prisma.aIArtifact.create({
    data: {
      actorId: user.id,
      nbaVersionId,
      screen,
      promptId: `ui-${Date.now()}`,
      modelVersion: "stub-1.0",
      inputs: { prompt },
      outputs: { message: output.message, reasonCodes: output.reasonCodes },
      confidence: clamp(output.confidence, 0, 1),
      guardrailFlags: output.guardrailFlags,
    },
  });

  return output;
}

