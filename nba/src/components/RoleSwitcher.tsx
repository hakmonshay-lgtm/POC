"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function RoleSwitcher({ initialRole, initialUserId }: { initialRole: string; initialUserId: string }) {
  const [role, setRole] = useState(initialRole);
  const [userId, setUserId] = useState(initialUserId);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, userId }),
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-[160px]">
        <option value="marketing">Marketing</option>
        <option value="legal">Legal</option>
        <option value="analyst">Analyst</option>
      </Select>
      <input
        className="h-10 w-[190px] rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="User ID"
      />
      <Button variant="secondary" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Switch"}
      </Button>
    </div>
  );
}

