"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/errors";

type Item = {
  id: string;
  nba_id: string;
  version: number;
  channel: string;
  subject: string;
  body: string;
  legal_status: string;
  legal_reviewer_id: string | null;
  legal_notes: string | null;
  updated_at: string;
  nba_name: string;
};

export function LegalInbox() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/inbox");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(templateId: string, decision: "Approved" | "Rejected") {
    setError(null);
    const res = await fetch("/api/legal/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId, decision, comments: comment[templateId] ?? "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    await load();
  }

  return (
    <Card>
      <CardHeader title="Legal Inbox" subtitle="Approve/reject customer-facing templates. Approval gates scheduling/publishing." />
      <CardBody>
        {error ? <div className="mb-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
        {!loading && items.length === 0 ? <div className="text-sm text-zinc-600">No templates waiting for review.</div> : null}
        <div className="space-y-4">
          {items.map((t) => (
            <div key={t.id} className="rounded-md border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/nbas/${t.nba_id}`} className="truncate text-sm font-medium text-zinc-900 hover:underline">
                      {t.nba_name}
                    </Link>
                    <span className="text-xs text-zinc-500">v{t.version}</span>
                    <Badge color={t.legal_status === "Rejected" ? "red" : "yellow"}>{t.legal_status}</Badge>
                    <Badge color="blue">{t.channel}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Updated: {new Date(t.updated_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => decide(t.id, "Rejected")}>
                    Reject
                  </Button>
                  <Button onClick={() => decide(t.id, "Approved")}>Approve</Button>
                </div>
              </div>

              {t.channel === "Email" ? (
                <div className="mt-3 text-sm text-zinc-700">
                  <div className="text-xs font-medium text-zinc-700">Subject</div>
                  <div className="mt-1 rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs">{t.subject || "—"}</div>
                </div>
              ) : null}

              <div className="mt-3">
                <div className="text-xs font-medium text-zinc-700">Body</div>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-800">{t.body}</pre>
              </div>

              <div className="mt-3">
                <div className="text-xs font-medium text-zinc-700">Comment</div>
                <Textarea value={comment[t.id] ?? ""} onChange={(e) => setComment((c) => ({ ...c, [t.id]: e.target.value }))} rows={2} placeholder="Approval notes / rejection reason…" />
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

