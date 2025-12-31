"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function RoleSwitcher({
  users,
  activeUserEmail,
  action,
}: {
  users: UserOption[];
  activeUserEmail: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const pathname = usePathname();
  const options = useMemo(
    () =>
      users.map((u) => ({
        value: u.email,
        label: `${u.name} • ${u.role}`,
      })),
    [users],
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="next" value={pathname || "/nba"} />
      <select
        name="userEmail"
        defaultValue={activeUserEmail}
        className="h-9 rounded-full border border-white/20 bg-white/10 px-3 text-xs text-white outline-none backdrop-blur hover:bg-white/15"
        aria-label="Active user"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-9 rounded-full bg-[var(--nba-green)] px-3 text-xs font-semibold text-black hover:brightness-95"
      >
        Switch
      </button>
    </form>
  );
}

