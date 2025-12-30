"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function SimulateIssue({ nbaId }: { nbaId: string }) {
  const [count, setCount] = useState(50);
  const [channel, setChannel] = useState("SMS");
  const [result, setResult] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function run() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/simulate/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nbaId, count, channel }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4">
      <div className="text-sm font-medium text-zinc-900">Simulation</div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">Count</div>
          <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">Channel</div>
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="SMS">SMS</option>
            <option value="Email">Email</option>
            <option value="Memo">Memo</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={run} disabled={saving}>
            {saving ? "Running…" : "Issue offers"}
          </Button>
        </div>
      </div>
      {result ? <pre className="max-h-48 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

