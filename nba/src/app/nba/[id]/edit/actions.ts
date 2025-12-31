"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

function parseISODateOrNull(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

export async function saveGeneralDetails(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const nextStep = String(formData.get("nextStep") ?? "general");

  const name = requiredString(formData.get("nbaName"), "NBA Name");
  const description = optionalString(formData.get("description")) ?? "";
  const start = parseISODateOrNull(optionalString(formData.get("startDate")));
  const end = parseISODateOrNull(optionalString(formData.get("endDate")));

  if (start && end && start.getTime() >= end.getTime()) {
    throw new Error("Start Date must be before End Date.");
  }

  const duplicate = await prisma.nba.findFirst({
    where: { name, NOT: { id: nbaId } },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("NBA Name must be unique.");
  }

  const nba = await prisma.nba.update({
    where: { id: nbaId },
    data: {
      name,
      description,
      startAt: start,
      endAt: end,
      updatedAt: new Date(),
    },
    select: { id: true, currentVersion: true },
  });

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: {
      generalDetails: { nbaName: name, description, startDate: start?.toISOString() ?? null, endDate: end?.toISOString() ?? null },
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "UPDATE_GENERAL_DETAILS",
      diff: { nbaId, version, fields: ["name", "description", "startAt", "endAt"] },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nba.id}/edit?version=${version}&step=${nextStep}`);
}

export async function saveGeneralDetailsClient(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; redirectTo?: string }> {
  try {
    const user = await getCurrentUser();
    const nbaId = requiredString(formData.get("nbaId"), "NBA id");
    const version = Number(requiredString(formData.get("version"), "Version"));
    const nextStep = String(formData.get("nextStep") ?? "general");

    const name = requiredString(formData.get("nbaName"), "NBA Name");
    const description = optionalString(formData.get("description")) ?? "";
    const start = parseISODateOrNull(optionalString(formData.get("startDate")));
    const end = parseISODateOrNull(optionalString(formData.get("endDate")));

    if (start && end && start.getTime() >= end.getTime()) {
      return { error: "Start Date must be before End Date." };
    }

    const duplicate = await prisma.nba.findFirst({
      where: { name, NOT: { id: nbaId } },
      select: { id: true },
    });
    if (duplicate) {
      return { error: "NBA Name must be unique." };
    }

    await prisma.nba.update({
      where: { id: nbaId },
      data: {
        name,
        description,
        startAt: start,
        endAt: end,
        updatedAt: new Date(),
      },
    });

    const v = await prisma.nbaVersion.update({
      where: { nbaId_version: { nbaId, version } },
      data: {
        generalDetails: { nbaName: name, description, startDate: start?.toISOString() ?? null, endDate: end?.toISOString() ?? null },
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: "NbaVersion",
        entityId: v.id,
        action: "UPDATE_GENERAL_DETAILS",
        diff: { nbaId, version, fields: ["name", "description", "startAt", "endAt"] },
        nbaVersionId: v.id,
      },
    });

    return { redirectTo: `/nba/${nbaId}/edit?version=${version}&step=${nextStep}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error." };
  }
}

export async function saveAudience(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const nextStep = String(formData.get("nextStep") ?? "audience");

  const abp = String(formData.get("abpEnrolled") ?? "any");
  const ccDays = Number(String(formData.get("ccExpiryDays") ?? "45"));
  const suppressHighRisk = String(formData.get("suppressHighRisk") ?? "on") === "on";

  const now = new Date();
  const cut = new Date(now);
  cut.setDate(cut.getDate() + ccDays);

  const where: Prisma.CustomerWhereInput = {
    creditCardExpAt: { not: null, lte: cut },
  };
  if (abp === "yes") where.abpEnrolled = true;
  if (abp === "no") where.abpEnrolled = false;
  // SQLite JSON querying is limited in this MVP; compute suppression in-memory.
  const candidates = await prisma.customer.findMany({
    where,
    select: { id: true, riskFlags: true },
  });
  const estimate = suppressHighRisk
    ? candidates.filter((c) => !String(c.riskFlags).includes("HIGH_COMPLAINT_RISK")).length
    : candidates.length;

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: {
      audience: {
        op: "AND",
        include: [
          { field: "creditCardExpAt", operator: "withinDays", value: ccDays },
          ...(abp === "any" ? [] : [{ field: "abpEnrolled", operator: "equals", value: abp === "yes" }]),
        ],
        exclude: suppressHighRisk ? [{ field: "riskFlags", operator: "contains", value: "HIGH_COMPLAINT_RISK" }] : [],
        estimate,
      },
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "UPDATE_AUDIENCE",
      diff: { nbaId, version, estimate },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=${nextStep}`);
}

export async function saveAction(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const nextStep = String(formData.get("nextStep") ?? "action");

  const type = requiredString(formData.get("actionType"), "Action type");
  const priority = Number(String(formData.get("priority") ?? "3"));
  const maxOffers = Number(String(formData.get("maxOffers") ?? "1"));
  const saleChannels = formData.getAll("saleChannels").map((v) => String(v));

  if (saleChannels.length === 0) throw new Error("At least one Sale Channel is required.");

  const completionEvent =
    type === "UPDATE_PAYMENT_PROFILE"
      ? "PAYMENT_PROFILE_UPDATED"
      : type === "COMPLETE_PROFILE"
        ? "PROFILE_COMPLETED"
        : "ACTION_COMPLETED";

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: {
      action: { type, completionEvent, saleChannels, priority, maxOffers },
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "UPDATE_ACTION",
      diff: { nbaId, version, type, saleChannels, priority, maxOffers },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=${nextStep}`);
}

export async function saveBenefit(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const nextStep = String(formData.get("nextStep") ?? "benefit");

  const type = requiredString(formData.get("benefitType"), "Benefit type");
  const value = Number(String(formData.get("benefitValue") ?? "0"));
  const cap = Number(String(formData.get("benefitCap") ?? "0"));

  if (type !== "NONE" && (!Number.isFinite(value) || value <= 0)) {
    throw new Error("Benefit value is required.");
  }

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: {
      benefit: { type, value, cap },
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "UPDATE_BENEFIT",
      diff: { nbaId, version, type, value, cap },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=${nextStep}`);
}

export async function saveComms(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const nextStep = String(formData.get("nextStep") ?? "comms");

  const legalReviewerId = optionalString(formData.get("legalReviewerId"));
  const legalNotes = optionalString(formData.get("legalNotes"));

  const channels = formData.getAll("channels").map((v) => String(v));

  if (channels.length === 0) throw new Error("Select at least one channel (SMS, Email, Memo).");

  const smsBody = optionalString(formData.get("smsBody"));
  const emailSubject = optionalString(formData.get("emailSubject"));
  const emailBody = optionalString(formData.get("emailBody"));
  const memoBody = optionalString(formData.get("memoBody"));

  const nbaVersion = await prisma.nbaVersion.findUniqueOrThrow({
    where: { nbaId_version: { nbaId, version } },
    select: { id: true },
  });

  // Upsert templates by (version, channel, name)
  async function upsertTemplate(channel: "SMS" | "EMAIL" | "MEMO", name: string, subject: string | null, body: string) {
    const existing = await prisma.commTemplate.findFirst({
      where: { nbaVersionId: nbaVersion.id, channel, name },
      select: { id: true },
    });

    if (existing) {
      await prisma.commTemplate.update({
        where: { id: existing.id },
        data: {
          subject,
          body,
          tokens: extractTokens(body + (subject ?? "")),
          legalStatus: "DRAFT",
        },
      });
      return;
    }

    await prisma.commTemplate.create({
      data: {
        nbaVersionId: nbaVersion.id,
        channel,
        name,
        subject,
        body,
        tokens: extractTokens(body + (subject ?? "")),
        legalStatus: "DRAFT",
      },
    });
  }

  if (channels.includes("SMS")) {
    await upsertTemplate("SMS", "SMS", null, smsBody ?? "");
  }
  if (channels.includes("EMAIL")) {
    await upsertTemplate("EMAIL", "Email", emailSubject ?? "", emailBody ?? "");
  }
  if (channels.includes("MEMO")) {
    await upsertTemplate("MEMO", "Customer Memo", null, memoBody ?? "");
  }

  const v = await prisma.nbaVersion.update({
    where: { id: nbaVersion.id },
    data: { legalNotes: legalNotes ?? null, updatedAt: new Date() },
    select: { id: true },
  });

  if (legalReviewerId) {
    await prisma.legalApproval.create({
      data: {
        nbaVersionId: nbaVersion.id,
        reviewerId: legalReviewerId,
        status: "DRAFT",
        comments: legalNotes ?? null,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "UPDATE_COMMS",
      diff: { nbaId, version, channels },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=${nextStep}`);
}

export async function submitForLegalReview(formData: FormData) {
  const user = await getCurrentUser();
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { legalStatus: "IN_REVIEW", status: "IN_LEGAL_REVIEW", updatedAt: new Date() },
    select: { id: true },
  });

  await prisma.commTemplate.updateMany({
    where: { nbaVersionId: v.id },
    data: { legalStatus: "IN_REVIEW", updatedAt: new Date() },
  });

  await prisma.nba.update({
    where: { id: nbaId },
    data: { status: "IN_LEGAL_REVIEW", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "SUBMIT_FOR_LEGAL_REVIEW",
      diff: { nbaId, version },
      nbaVersionId: v.id,
    },
  });

  redirect(`/legal`);
}

function extractTokens(text: string) {
  const tokens = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_ ]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tokens.add(m[1].trim());
  }
  return Array.from(tokens);
}

export async function legalApprove(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "LEGAL" && user.role !== "ADMIN") throw new Error("Only Legal can approve communications.");

  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const comments = optionalString(formData.get("comments"));

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { legalStatus: "APPROVED", status: "APPROVED", updatedAt: new Date() },
    select: { id: true },
  });

  await prisma.commTemplate.updateMany({
    where: { nbaVersionId: v.id },
    data: { legalStatus: "APPROVED", updatedAt: new Date() },
  });

  await prisma.nba.update({
    where: { id: nbaId },
    data: { status: "APPROVED", updatedAt: new Date() },
  });

  await prisma.legalApproval.create({
    data: {
      nbaVersionId: v.id,
      reviewerId: user.id,
      status: "APPROVED",
      comments: comments ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "LEGAL_APPROVE",
      diff: { nbaId, version, comments: comments ?? null },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=summary`);
}

export async function legalReject(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "LEGAL" && user.role !== "ADMIN") throw new Error("Only Legal can reject communications.");

  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));
  const comments = optionalString(formData.get("comments"));

  const v = await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { legalStatus: "REJECTED", status: "DRAFT", updatedAt: new Date() },
    select: { id: true },
  });

  await prisma.commTemplate.updateMany({
    where: { nbaVersionId: v.id },
    data: { legalStatus: "REJECTED", updatedAt: new Date() },
  });

  await prisma.nba.update({
    where: { id: nbaId },
    data: { status: "DRAFT", updatedAt: new Date() },
  });

  await prisma.legalApproval.create({
    data: {
      nbaVersionId: v.id,
      reviewerId: user.id,
      status: "REJECTED",
      comments: comments ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "NbaVersion",
      entityId: v.id,
      action: "LEGAL_REJECT",
      diff: { nbaId, version, comments: comments ?? null },
      nbaVersionId: v.id,
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=comms`);
}

export async function scheduleNba(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "MARKETING" && user.role !== "ADMIN") throw new Error("Only Marketing can schedule NBAs.");
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));

  await prisma.nba.update({ where: { id: nbaId }, data: { status: "SCHEDULED", updatedAt: new Date() } });
  await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { status: "SCHEDULED", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "Nba",
      entityId: nbaId,
      action: "SCHEDULE",
      diff: { nbaId, version },
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=summary`);
}

export async function publishNba(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "MARKETING" && user.role !== "ADMIN") throw new Error("Only Marketing can publish NBAs.");
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));

  const v = await prisma.nbaVersion.findUniqueOrThrow({ where: { nbaId_version: { nbaId, version } } });
  if (v.legalStatus !== "APPROVED") throw new Error("Legal approval is required before publishing.");

  await prisma.nba.update({ where: { id: nbaId }, data: { status: "PUBLISHED", updatedAt: new Date() } });
  await prisma.nbaVersion.update({
    where: { id: v.id },
    data: { status: "PUBLISHED", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "Nba",
      entityId: nbaId,
      action: "PUBLISH",
      diff: { nbaId, version },
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=summary`);
}

export async function terminateNba(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "MARKETING" && user.role !== "ADMIN") throw new Error("Only Marketing can terminate NBAs.");
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));

  await prisma.nba.update({ where: { id: nbaId }, data: { status: "TERMINATED", updatedAt: new Date() } });
  await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { status: "TERMINATED", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "Nba",
      entityId: nbaId,
      action: "TERMINATE",
      diff: { nbaId, version },
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=summary`);
}

export async function archiveNba(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "MARKETING" && user.role !== "ADMIN") throw new Error("Only Marketing can archive NBAs.");
  const nbaId = requiredString(formData.get("nbaId"), "NBA id");
  const version = Number(requiredString(formData.get("version"), "Version"));

  await prisma.nba.update({ where: { id: nbaId }, data: { status: "ARCHIVED", updatedAt: new Date() } });
  await prisma.nbaVersion.update({
    where: { nbaId_version: { nbaId, version } },
    data: { status: "ARCHIVED", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      entityType: "Nba",
      entityId: nbaId,
      action: "ARCHIVE",
      diff: { nbaId, version },
    },
  });

  redirect(`/nba/${nbaId}/edit?version=${version}&step=summary`);
}

