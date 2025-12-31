"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

function makeDraftName() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `New NBA ${stamp} ${rand}`;
}

export async function createDraftNba() {
  const user = await getCurrentUser();
  const name = makeDraftName();

  const nba = await prisma.nba.create({
    data: {
      name,
      description: "",
      status: "DRAFT",
      startAt: null,
      endAt: null,
      ownerId: user.id,
      priority: 3,
      arbitrationWeight: 50,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          status: "DRAFT",
          generalDetails: { nbaName: name, description: "", startDate: null, endDate: null },
          audience: { op: "AND", include: [], exclude: [], estimate: null },
          action: { type: null, completionEvent: null, saleChannels: [], priority: 3, maxOffers: 1 },
          benefit: { type: null },
          legalStatus: "DRAFT",
        },
      },
    },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const latest = nba.versions[0];
  redirect(`/nba/${nba.id}/edit?version=${latest?.version ?? 1}&step=general`);
}

export async function cloneNba(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = String(formData.get("nbaId") ?? "");
  if (!nbaId) throw new Error("NBA id is required.");

  const source = await prisma.nba.findUnique({
    where: { id: nbaId },
    include: { versions: { orderBy: { version: "desc" }, take: 1, include: { templates: true } } },
  });
  if (!source) throw new Error("NBA not found.");

  const baseName = `Copy of ${source.name}`;
  let name = baseName;
  let i = 2;
  while (await prisma.nba.findUnique({ where: { name } })) {
    name = `${baseName} (${i++})`;
  }

  const latest = source.versions[0];
  const defaultAudience: Prisma.InputJsonValue = { op: "AND", include: [], exclude: [], estimate: null };
  const defaultAction: Prisma.InputJsonValue = { type: null, completionEvent: null, saleChannels: [], priority: 3, maxOffers: 1 };
  const defaultBenefit: Prisma.InputJsonValue = { type: null };
  const latestGeneral = (latest?.generalDetails ?? {}) as unknown as Record<string, unknown>;
  const cloned = await prisma.nba.create({
    data: {
      name,
      description: source.description ?? "",
      startAt: source.startAt,
      endAt: source.endAt,
      status: "DRAFT",
      ownerId: user.id,
      priority: source.priority,
      arbitrationWeight: source.arbitrationWeight,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          status: "DRAFT",
          generalDetails: { ...latestGeneral, nbaName: name } as Prisma.InputJsonValue,
          audience: ((latest?.audience ?? defaultAudience) as unknown as Prisma.InputJsonValue),
          action: ((latest?.action ?? defaultAction) as unknown as Prisma.InputJsonValue),
          benefit: ((latest?.benefit ?? defaultBenefit) as unknown as Prisma.InputJsonValue),
          legalStatus: "DRAFT",
          templates: {
            create: (latest?.templates ?? []).map((t) => ({
              channel: t.channel,
              name: t.name,
              subject: t.subject,
              body: t.body,
              tokens: t.tokens as unknown as Prisma.InputJsonValue,
              legalStatus: "DRAFT",
            })),
          },
        },
      },
    },
    include: { versions: { take: 1 } },
  });

  redirect(`/nba/${cloned.id}/edit?version=1&step=general`);
}

