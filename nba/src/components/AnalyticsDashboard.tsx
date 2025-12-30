"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type NbaItem = { id: string; name: string };
type NbaApiItem = { id: string; name: string };
type Summary = {
  metrics: { reach: number; redeemed: number; conversion: number; revenue: number };
  byChannel: Array<{ channel: string; reach: number; redeemed: number; conversion: number }>;
};

export function AnalyticsDashboard() {
  const [nbas, setNbas] = useState<NbaItem[]>([]);
  const [nbaId, setNbaId] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadNbas() {
      const res = await fetch("/api/nba");
      const data = await res.json();
      const items = (data.items ?? []) as NbaApiItem[];
      setNbas(items.map((x) => ({ id: x.id, name: x.name })));
      if (!nbaId && items[0]?.id) setNbaId(items[0].id);
    }
    void loadNbas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadSummary() {
      if (!nbaId) return;
      setLoading(true);
      const res = await fetch(`/api/analytics/summary?nbaId=${encodeURIComponent(nbaId)}`);
      const data = await res.json();
      setSummary(data);
      setLoading(false);
    }
    void loadSummary();
  }, [nbaId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-zinc-900">Analytics</div>
          <div className="text-sm text-zinc-600">Funnel metrics (MVP): reach, redemption, conversion, by channel.</div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">NBA</div>
            <Select value={nbaId} onChange={(e) => setNbaId(e.target.value)} className="w-[340px]">
              {nbas.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </div>
          {nbaId ? (
            <Link href={`/nbas/${nbaId}`}>
              <Button variant="secondary">Open</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title="Summary" subtitle="Numbers are derived from simulated assignments (see NBA detail page)." />
        <CardBody>
          {loading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
          {!loading && summary ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500">Reach</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">{summary.metrics.reach}</div>
              </div>
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500">Redeemed</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">{summary.metrics.redeemed}</div>
              </div>
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500">Conversion</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">{(summary.metrics.conversion * 100).toFixed(1)}%</div>
              </div>
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="text-xs text-zinc-500">Revenue (placeholder)</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">${Number(summary.metrics.revenue).toFixed(0)}</div>
              </div>
            </div>
          ) : null}

          {!loading && summary ? (
            <div className="mt-6">
              <div className="text-sm font-medium text-zinc-900">By channel</div>
              <div className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {summary.byChannel.map((r: { channel: string; reach: number; redeemed: number; conversion: number }) => (
                  <div key={r.channel} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="font-medium text-zinc-900">{r.channel}</div>
                    <div className="flex items-center gap-6 text-zinc-700">
                      <div>Reach: {r.reach}</div>
                      <div>Redeemed: {r.redeemed}</div>
                      <div>Conv: {(r.conversion * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
                {!summary.byChannel.length ? <div className="px-4 py-6 text-sm text-zinc-600">No data yet. Use “Issue offers” simulation.</div> : null}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

