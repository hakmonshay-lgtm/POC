"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/errors";

type VersionRow = {
  id: string;
  nba_id: string;
  version: number;
  material_change: 0 | 1;
  change_summary: string | null;
  created_by: string;
  created_at: string;
};

export function NbaVersionHistory({ nbaId }: { nbaId: string }) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromV, setFromV] = useState<number | null>(null);
  const [toV, setToV] = useState<number | null>(null);
  const [patch, setPatch] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nba/${encodeURIComponent(nbaId)}/versions`);
      const data = await res.json();
      const items = (data.items ?? []) as VersionRow[];
      setVersions(items);
      if (items.length >= 2) {
        setToV(items[0]!.version);
        setFromV(items[1]!.version);
      } else if (items.length === 1) {
        setToV(items[0]!.version);
        setFromV(items[0]!.version);
      }
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbaId]);

  const versionOptions = useMemo(() => versions.map((v) => v.version).sort((a, b) => b - a), [versions]);

  async function loadDiff() {
    if (fromV == null || toV == null) return;
    setError(null);
    setPatch("");
    const res = await fetch(`/api/nba/${encodeURIComponent(nbaId)}/diff?from=${encodeURIComponent(fromV)}&to=${encodeURIComponent(toV)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to load diff");
      return;
    }
    setPatch(String(data.patch ?? ""));
  }

  return (
    <Card>
      <CardHeader title="Version history" subtitle="One snapshot per version + audit log for granular changes." />
      <CardBody>
        {error ? <div className="mb-3 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-zinc-600">Loading…</div> : null}

        {!loading ? (
          <div className="grid gap-4">
            <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
              {versions.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">v{v.version}</span>
                    <Badge color={v.material_change ? "yellow" : "zinc"}>{v.material_change ? "Material" : "Snapshot"}</Badge>
                    <span className="text-xs text-zinc-500">{v.change_summary ?? "—"}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(v.created_at).toLocaleString()} · {v.created_by}
                  </div>
                </div>
              ))}
              {versions.length === 0 ? <div className="px-3 py-6 text-sm text-zinc-600">No versions yet.</div> : null}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">From</div>
                  <Select value={String(fromV ?? "")} onChange={(e) => setFromV(Number(e.target.value))} className="w-[140px]">
                    {versionOptions.map((v) => (
                      <option key={v} value={v}>
                        v{v}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">To</div>
                  <Select value={String(toV ?? "")} onChange={(e) => setToV(Number(e.target.value))} className="w-[140px]">
                    {versionOptions.map((v) => (
                      <option key={v} value={v}>
                        v{v}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button variant="secondary" onClick={() => void loadDiff()} disabled={fromV == null || toV == null}>
                  View diff
                </Button>
              </div>
              <Button variant="ghost" onClick={() => setPatch("")}>
                Clear
              </Button>
            </div>

            {patch ? <pre className="max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{patch}</pre> : <div className="text-xs text-zinc-500">Select versions and click “View diff”.</div>}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

