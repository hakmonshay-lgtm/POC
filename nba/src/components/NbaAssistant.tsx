"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

type Msg = { id: string; role: "user" | "assistant"; text: string; ts: string };

type UnknownRecord = Record<string, unknown>;

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function summarizeResponse(out: unknown) {
  if (!out) return "";
  if (!isRecord(out)) return safeStringify(out);
  const suggestions = out["suggestions"];
  if (!isRecord(suggestions)) return safeStringify(out);

  const execSummary = suggestions["execSummary"];
  if (typeof execSummary === "string") return execSummary;

  const readinessScore = suggestions["readinessScore"];
  if (typeof readinessScore === "number") return `Readiness score: ${readinessScore}/100\n\n${safeStringify(suggestions)}`;

  const options = suggestions["options"];
  if (Array.isArray(options)) {
    const lines = options
      .map((o) => (isRecord(o) ? o : null))
      .filter(Boolean)
      .map((o) => {
        const type = String(o!.type ?? "unknown");
        const conf = typeof o!.confidence === "number" ? Math.round(o!.confidence * 100) : null;
        return `- ${type}${conf != null ? ` (confidence ${conf}%)` : ""}`;
      });
    return lines.length ? `Recommended actions:\n${lines.join("\n")}` : safeStringify(out);
  }

  const templates = suggestions["templates"];
  if (Array.isArray(templates)) {
    const lines = templates
      .map((t) => (isRecord(t) ? t : null))
      .filter(Boolean)
      .map((t) => {
        const ch = String(t!.channel ?? "Channel");
        const subject = String(t!.subject ?? "");
        const body = String(t!.body ?? "");
        const bodyShort = body.slice(0, 220) + (body.length > 220 ? "…" : "");
        return `- ${ch}${subject ? ` · ${subject}` : ""}\n  ${bodyShort}`;
      });
    return lines.length ? `Draft templates:\n${lines.join("\n")}` : safeStringify(out);
  }

  const rules = suggestions["rules"];
  if (rules) return `Suggested audience rules:\n${safeStringify(rules)}`;

  return safeStringify(out);
}

export function NbaAssistant({
  screen,
  context,
}: {
  screen: "general" | "audience" | "action" | "benefit" | "comms" | "summary";
  context: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo<Msg>(
    () => ({
      id: "greeting",
      role: "assistant",
      text: "I’m your NBA Assistant. Ask me anything about this NBA.",
      ts: new Date().toISOString(),
    }),
    [],
  );

  useEffect(() => {
    if (messages.length === 0) setMessages([greeting]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const p = prompt.trim();
    if (!p) return;
    setError(null);
    setSending(true);
    const now = new Date().toISOString();
    const userMsg: Msg = { id: `${now}-u`, role: "user", text: p, ts: now };
    setMessages((m) => [...m, userMsg]);
    setPrompt("");
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ screen, prompt: p, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      const outText = summarizeResponse(data);
      const aiMsg: Msg = { id: `${now}-a`, role: "assistant", text: outText, ts: new Date().toISOString() };
      setMessages((m) => [...m, aiMsg]);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border-2 border-[var(--cw-green)] bg-white shadow-xl">
          <div className="flex items-center justify-between bg-[var(--cw-green)] px-4 py-3 text-white">
            <div className="text-sm font-semibold">NBA Assistant</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-sm hover:bg-white/15"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[360px] overflow-auto bg-white p-3">
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-zinc-100 text-zinc-900" : "bg-white text-zinc-900 ring-1 ring-zinc-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">{new Date(m.ts).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {error ? <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
          </div>
          <div className="border-t border-zinc-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask me anything"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
              />
              <Button onClick={() => void send()} disabled={sending}>
                {sending ? "…" : "Send"}
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Context: <span className="font-mono">{screen}</span>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full bg-[var(--cw-green)] text-sm font-semibold text-white shadow-lg ring-4 ring-[rgba(43,179,74,0.20)] hover:bg-[var(--cw-green-dark)]"
        aria-label="Open NBA Assistant"
      >
        Ask
        <br />
        NBA
      </button>
    </>
  );
}

