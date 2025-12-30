import { z } from "zod";

export const RoleSchema = z.enum(["marketing", "legal", "analyst"]);
export type Role = z.infer<typeof RoleSchema>;

export const NbaStatusSchema = z.enum([
  "Draft",
  "Submitted",
  "In Legal Review",
  "Approved",
  "Scheduled",
  "Published",
  "Terminated",
  "Completed",
  "Archived",
]);
export type NbaStatus = z.infer<typeof NbaStatusSchema>;

export const ChannelSchema = z.enum(["SMS", "Email", "Memo"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const LegalStatusSchema = z.enum(["Not Required", "In Review", "Approved", "Rejected"]);
export type LegalStatus = z.infer<typeof LegalStatusSchema>;

export const RuleOperatorSchema = z.enum(["=", "!=", ">", ">=", "<", "<=", "in"]);
export type RuleOperator = z.infer<typeof RuleOperatorSchema>;

export const RuleFieldSchema = z.enum([
  "plan",
  "tenure_months",
  "purchases_12mo",
  "complaints_12mo",
  "risk_flag",
  "consent_sms",
  "consent_email",
]);
export type RuleField = z.infer<typeof RuleFieldSchema>;

export const RuleConditionSchema = z.object({
  kind: z.literal("condition"),
  field: RuleFieldSchema,
  op: RuleOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]),
});
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

export type RuleGroup = {
  kind: "group";
  op: "AND" | "OR";
  rules: Array<RuleCondition | RuleGroup>;
};

export const RuleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    op: z.enum(["AND", "OR"]),
    rules: z.array(z.union([RuleConditionSchema, RuleGroupSchema])),
  }),
);
export type AudienceRules = RuleGroup;

export const NbaGeneralSchema = z.object({
  name: z.string().trim().min(3, "Name is required").max(120),
  description: z.string().trim().max(1000).optional().default(""),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  priority: z.number().int().min(1).max(10).default(5),
  arbitrationWeight: z.number().min(0.1).max(10).default(1),
});

export const ActionSchema = z.object({
  type: z
    .enum([
      "purchase_sku",
      "change_plan",
      "enroll_abp",
      "update_payment_profile",
      "referral",
      "usage_milestone",
      "complete_profile",
    ])
    .default("purchase_sku"),
  completionEvent: z.string().trim().min(2),
  saleChannels: z.array(z.enum(["Store", "Care", "SelfService", "Web"])).min(1),
  offerPriority: z.number().int().min(1).max(10).default(5),
  maxOffersPerCustomer: z.number().int().min(1).max(10).default(1),
});

export const BenefitSchema = z.object({
  type: z.enum(["order_discount", "one_time_credit", "recurring_credit", "free_add_on"]),
  valueNumber: z.number().min(0.01),
  valueUnit: z.enum(["percent", "usd", "points", "add_on"]).default("usd"),
  capNumber: z.number().min(0.01),
  threshold: z
    .object({
      minTenureMonths: z.number().int().min(0).optional(),
      minPurchases12mo: z.number().int().min(0).optional(),
    })
    .default({}),
  stackability: z
    .object({
      allowed: z.boolean().default(false),
      exclusivityTags: z.array(z.string().trim().min(1)).default([]),
    })
    .default({ allowed: false, exclusivityTags: [] }),
  exclusions: z
    .object({
      excludedOfferIds: z.array(z.string().trim().min(1)).default([]),
    })
    .default({ excludedOfferIds: [] }),
  redemptionLogic: z.enum(["auto_apply", "promo_code", "rep_assisted"]).default("auto_apply"),
  description: z.string().trim().min(3).max(240),
});

export const TemplateSchema = z.object({
  channel: ChannelSchema,
  subject: z.string().trim().max(140).optional().default(""),
  body: z.string().trim().min(3).max(4000),
});

export const CommsSchema = z.object({
  channels: z.array(ChannelSchema).min(1),
  templates: z.array(TemplateSchema).min(1),
  legalReviewerId: z.string().trim().min(1).optional(),
  legalNotes: z.string().trim().max(2000).optional().default(""),
});

export function assertStartBeforeEnd(startIso: string, endIso: string) {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return;
  if (s >= e) throw new Error("Start Date must be before End Date");
}

