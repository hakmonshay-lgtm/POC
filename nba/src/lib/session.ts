import { cookies } from "next/headers";
import { RoleSchema, type Role } from "@/lib/domain";

export type Session = {
  userId: string;
  role: Role;
};

export async function getSession(): Promise<Session> {
  const c = await cookies();
  const roleRaw = c.get("nba_role")?.value ?? "marketing";
  const role = RoleSchema.catch("marketing").parse(roleRaw);
  const userId = c.get("nba_user")?.value ?? `${role.toUpperCase()}-USER-1`;
  return { userId, role };
}

