import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "nba_user_email";

export async function getCurrentUser() {
  const store = await cookies();
  const email = store.get(SESSION_COOKIE)?.value;

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) return user;
  }

  // Fallback: first Marketing user, else first user.
  const marketing = await prisma.user.findFirst({ where: { role: "MARKETING" } });
  if (marketing) return marketing;

  const anyUser = await prisma.user.findFirst();
  if (anyUser) return anyUser;

  // If DB not seeded, return a safe placeholder.
  return {
    id: "anonymous",
    name: "Anonymous",
    email: "anonymous@local",
    role: "MARKETING" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

