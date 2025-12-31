"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
      <Input
        className="w-[190px]"
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

