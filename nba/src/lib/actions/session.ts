"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieName } from "@/lib/session";

export async function setActiveUser(formData: FormData) {
  const email = String(formData.get("userEmail") ?? "");
  const next = String(formData.get("next") ?? "/nba");

  const store = await cookies();
  store.set(getSessionCookieName(), email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next);
}

