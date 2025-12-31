import { PrismaClient, Role, Channel, LegalStatus, NbaStatus } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  // Clean slate (SQLite dev only)
  await prisma.aIArtifact.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.legalApproval.deleteMany();
  await prisma.commTemplate.deleteMany();
  await prisma.nbaVersion.deleteMany();
  await prisma.nba.deleteMany();
  await prisma.arbitrationScore.deleteMany();
  await prisma.offerAssignment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const marketing = await prisma.user.create({
    data: { name: "Morgan Marketer", email: "morgan@company.test", role: Role.MARKETING },
  });
  const legal = await prisma.user.create({
    data: { name: "Lena Legal", email: "lena@company.test", role: Role.LEGAL },
  });
  const analyst = await prisma.user.create({
    data: { name: "Dana Analyst", email: "dana@company.test", role: Role.ANALYST },
  });

  // Customers (mock CDP snapshot)
  const customers = await prisma.customer.createManyAndReturn({
    data: Array.from({ length: 250 }).map((_, i) => {
      const ccExpDays = 10 + (i % 90);
      const purchases12mo = (i % 5) + (i % 3 === 0 ? 2 : 0);
      const abp = i % 4 === 0;
      const consentSms = i % 2 === 0;
      const consentEmail = i % 3 !== 0;
      const risk = i % 17 === 0 ? ["HIGH_COMPLAINT_RISK"] : [];
      return {
        firstName: ["Alex", "Sam", "Chris", "Jordan", "Taylor", "Jamie"][i % 6],
        lastName: ["Lee", "Patel", "Garcia", "Nguyen", "Kim", "Brown"][i % 6],
        email: `customer${i}@example.test`,
        phone: `+1555000${String(i).padStart(4, "0")}`,
        consentSms,
        consentEmail,
        riskFlags: risk,
        tenureMonths: 2 + (i % 48),
        purchases12mo,
        abpEnrolled: abp,
        creditCardExpAt: daysFromNow(ccExpDays),
      };
    }),
  });

  // Example NBA: Credit Card Expiration Date
  const nba = await prisma.nba.create({
    data: {
      name: "Credit Card Expiration Date",
      description: "Proactively prompt customers to update expiring payment methods to avoid service interruption.",
      startAt: daysFromNow(3),
      endAt: daysFromNow(60),
      status: NbaStatus.DRAFT,
      ownerId: marketing.id,
      priority: 3,
      arbitrationWeight: 65,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          status: NbaStatus.DRAFT,
          generalDetails: {
            nbaName: "Credit Card Expiration Date",
            actionName: "Update Credit Card Details",
            effectiveDate: daysFromNow(3).toISOString().slice(0, 10),
            expirationDate: daysFromNow(60).toISOString().slice(0, 10),
          },
          audience: {
            op: "AND",
            include: [
              { field: "creditCardExpAt", operator: "withinDays", value: 45 },
              { field: "consentSms", operator: "equals", value: true },
            ],
            exclude: [{ field: "riskFlags", operator: "contains", value: "HIGH_COMPLAINT_RISK" }],
            estimate: 51153,
          },
          action: {
            type: "UPDATE_PAYMENT_PROFILE",
            completionEvent: "PAYMENT_PROFILE_UPDATED",
            saleChannels: ["CARE", "RETAIL"],
            priority: 3,
            maxOffers: 3,
          },
          benefit: {
            type: "NONE",
            description: "Keep service uninterrupted by updating payment details.",
          },
          legalStatus: LegalStatus.DRAFT,
          templates: {
            create: [
              {
                channel: Channel.SMS,
                name: "SMS 1",
                body: "Dear {{firstName}}, your registered card will expire in 45 days. Update now to avoid interruption: {{shortUrl}}",
                tokens: ["firstName", "shortUrl"],
              },
              {
                channel: Channel.MEMO,
                name: "Customer Memo",
                body: "Payment method update required: customer card expiring soon. Assist with updating payment profile.",
                tokens: [],
              },
            ],
          },
        },
      },
    },
    include: { versions: { include: { templates: true } } },
  });

  // A second NBA already in legal review
  await prisma.nba.create({
    data: {
      name: "Complete Profile → Get 10% Off",
      description: "Drive profile completion with a lightweight incentive.",
      startAt: daysFromNow(1),
      endAt: daysFromNow(30),
      status: NbaStatus.IN_LEGAL_REVIEW,
      ownerId: marketing.id,
      priority: 2,
      arbitrationWeight: 70,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          status: NbaStatus.IN_LEGAL_REVIEW,
          generalDetails: {
            nbaName: "Complete Profile → Get 10% Off",
            actionName: "Complete Profile",
            effectiveDate: daysFromNow(1).toISOString().slice(0, 10),
            expirationDate: daysFromNow(30).toISOString().slice(0, 10),
          },
          audience: {
            op: "AND",
            include: [{ field: "tenureMonths", operator: "gte", value: 1 }],
            exclude: [],
            estimate: 83210,
          },
          action: {
            type: "COMPLETE_PROFILE",
            completionEvent: "PROFILE_COMPLETED",
            saleChannels: ["SELF_SERVICE"],
            priority: 2,
            maxOffers: 2,
          },
          benefit: {
            type: "ORDER_DISCOUNT",
            value: 10,
            unit: "PERCENT",
            cap: { type: "TOTAL_LIABILITY", value: 50000 },
            stackability: { allow: false, exclusions: ["HOLIDAY_PROMO_2025"] },
            redemptionLogic: "AUTO_APPLY",
          },
          legalStatus: LegalStatus.IN_REVIEW,
          templates: {
            create: [
              {
                channel: Channel.SMS,
                name: "SMS",
                body: "Hi {{firstName}}—complete your profile today and get 10% off your next add-on. Reply STOP to opt out. {{shortUrl}}",
                tokens: ["firstName", "shortUrl"],
                legalStatus: LegalStatus.IN_REVIEW,
              },
              {
                channel: Channel.EMAIL,
                name: "Email",
                subject: "Finish your profile and save 10%",
                body: "Hi {{firstName}}, complete your profile to unlock 10% off. {{ctaUrl}}",
                tokens: ["firstName", "ctaUrl"],
                legalStatus: LegalStatus.IN_REVIEW,
              },
            ],
          },
          approvals: {
            create: {
              reviewerId: legal.id,
              status: LegalStatus.IN_REVIEW,
              comments: "Initial review started.",
            },
          },
        },
      },
    },
  });

  // Create a few events + assignments for analytics demo
  const sampleCustomerIds = customers.slice(0, 40).map((c) => c.id);
  await prisma.event.createMany({
    data: sampleCustomerIds.flatMap((customerId, idx) => {
      const base = [
        { customerId, type: "OFFER_ISSUED", payload: { nbaId: nba.id } },
        { customerId, type: "SMS_DELIVERED", payload: { nbaId: nba.id } },
      ];
      if (idx % 4 === 0) base.push({ customerId, type: "SMS_CLICKED", payload: { nbaId: nba.id } });
      if (idx % 7 === 0) base.push({ customerId, type: "PAYMENT_PROFILE_UPDATED", payload: { nbaId: nba.id } });
      return base.map((e, i) => ({ ...e, createdAt: daysFromNow(-(10 - i)) }));
    }),
  });

  await prisma.offerAssignment.createMany({
    data: sampleCustomerIds.map((customerId, idx) => ({
      customerId,
      nbaId: nba.id,
      status: idx % 7 === 0 ? "REDEEMED" : "ISSUED",
      issuedAt: daysFromNow(-10),
      redeemedAt: idx % 7 === 0 ? daysFromNow(-3) : null,
    })),
  });

  // Basic scoring snapshots
  await prisma.arbitrationScore.createMany({
    data: customers.slice(0, 30).map((c, idx) => ({
      customerId: c.id,
      nbaId: nba.id,
      score: 0.4 + (idx % 10) * 0.05,
      factors: {
        creditCardExpirySoon: true,
        consentSms: c.consentSms,
        riskFlags: c.riskFlags,
        fatigue: idx % 5 === 0 ? 0.2 : 0.05,
      },
    })),
  });

  // Example AI artifacts
  await prisma.aIArtifact.create({
    data: {
      actorId: marketing.id,
      nbaVersionId: nba.versions[0]?.id,
      screen: "general-details",
      promptId: "seed-001",
      modelVersion: "stub-1.0",
      inputs: { goal: "reduce payment failures", season: "Q1", tone: "brand" },
      outputs: {
        suggestedName: "Credit Card Expiration Date",
        suggestedDates: { start: daysFromNow(3).toISOString(), end: daysFromNow(60).toISOString() },
        reasonCodes: ["HISTORICAL_LIFT_Q1", "LOW_FATIGUE_WINDOW", "PAYMENT_FAILURE_PREVENTION"],
      },
      confidence: 0.81,
      guardrailFlags: [],
    },
  });

  // Seed an audit entry
  await prisma.auditLog.create({
    data: {
      actorId: marketing.id,
      entityType: "Nba",
      entityId: nba.id,
      action: "CREATE",
      diff: { created: true, name: nba.name, version: 1 },
      nbaVersionId: nba.versions[0]?.id,
    },
  });

  console.log("Seeded:", {
    users: { marketing: marketing.email, legal: legal.email, analyst: analyst.email },
    nbaCount: await prisma.nba.count(),
    customerCount: await prisma.customer.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

