"use client";

import { useMemo, useState, useTransition } from "react";

type AiOutput = {
  message: string;
  reasonCodes: string[];
  confidence: number;
  guardrailFlags: string[];
};

type ChatMsg =
  | { role: "user"; content: string }
  | { role: "ai"; content: string; meta?: { reasonCodes: string[]; confidence: number; guardrailFlags: string[] } };

export function AiAssistant({
  nbaVersionId,
  screen,
  run,
}: {
  nbaVersionId: string;
  screen: string;
  run: (args: { nbaVersionId: string; screen: string; prompt: string }) => Promise<AiOutput>;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isPending, startTransition] = useTransition();

  const suggestions = useMemo(() => {
    const map: Record<string, string[]> = {
      general: [
        "Propose a high-impact NBA name and dates for a Q1 retention campaign.",
        "Recommend arbitration priority for an upgrade offer vs. loyalty action.",
      ],
      audience: [
        "Create an audience of upgrade-likely customers with low complaint risk and ≥2 purchases last 12 months.",
        "Suggest exclusions to minimize churn risk while keeping reach high.",
      ],
      action: ["Which action yields highest completion within 10 days for this audience?"],
      benefit: ["Optimize between 10% off vs. $10 credit; keep liability ≤$50k."],
      comms: ["Write a 160-char SMS with {{firstName}} and CTA, TCPA-compliant."],
      summary: ["Run a what-if: add Email fallback to SMS; estimate CTR and conversion delta."],
    };
    return map[screen] ?? map.summary;
  }, [screen]);

  function ask(prompt: string) {
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    startTransition(async () => {
      const out = await run({ nbaVersionId, screen, prompt });
      setMessages((m) => [
        ...m,
        { role: "ai", content: out.message, meta: { reasonCodes: out.reasonCodes, confidence: out.confidence, guardrailFlags: out.guardrailFlags } },
      ]);
    });
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 rounded-2xl border-2 border-[var(--nba-green)] bg-white shadow-sm dark:bg-slate-950">
        <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-[var(--nba-green)] px-3 py-2 text-sm font-semibold text-black">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/10">✦</span>
            NBA Assistant
          </div>
          <span className={`h-2 w-2 rounded-full ${isPending ? "bg-black/70" : "bg-black/30"}`} />
        </div>

        <div className="p-3">
          <div className="text-xs text-[var(--nba-muted)]">Ask me anything about NBA</div>

          <div className="mt-3 space-y-2">
            {messages.length === 0 ? (
              <div className="space-y-2">
                {suggestions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => ask(p)}
                    className="w-full rounded-xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border border-[var(--nba-border)] p-2 text-xs ${
                      m.role === "user" ? "bg-white dark:bg-slate-950" : "bg-[var(--nba-card)]"
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold text-[var(--nba-muted)]">
                      {m.role === "user" ? "You" : "AI"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {"meta" in m && m.meta ? (
                      <div className="mt-2 text-[10px] text-[var(--nba-muted)]">
                        Reason codes: {m.meta.reasonCodes.join(", ")} • Confidence:{" "}
                        {(m.meta.confidence * 100).toFixed(0)}%
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 text-[10px] text-[var(--nba-muted)]">
            AI is a stub in this MVP; all calls are logged to the audit/AI artifact tables.
          </div>
        </div>
      </div>
    </aside>
  );
}

