-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Nba" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "arbitrationWeight" INTEGER NOT NULL DEFAULT 50,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Nba_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NbaVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nbaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isMaterial" BOOLEAN NOT NULL DEFAULT true,
    "generalDetails" JSONB NOT NULL,
    "audience" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "benefit" JSONB NOT NULL,
    "legalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "legalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NbaVersion_nbaId_fkey" FOREIGN KEY ("nbaId") REFERENCES "Nba" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nbaVersionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "legalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommTemplate_nbaVersionId_fkey" FOREIGN KEY ("nbaVersionId") REFERENCES "NbaVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nbaVersionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalApproval_nbaVersionId_fkey" FOREIGN KEY ("nbaVersionId") REFERENCES "NbaVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegalApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "nbaVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_nbaVersionId_fkey" FOREIGN KEY ("nbaVersionId") REFERENCES "NbaVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "consentSms" BOOLEAN NOT NULL DEFAULT false,
    "consentEmail" BOOLEAN NOT NULL DEFAULT false,
    "riskFlags" JSONB NOT NULL,
    "tenureMonths" INTEGER NOT NULL DEFAULT 0,
    "purchases12mo" INTEGER NOT NULL DEFAULT 0,
    "abpEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "creditCardExpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfferAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "nbaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" DATETIME,
    CONSTRAINT "OfferAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArbitrationScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "nbaId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "factors" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArbitrationScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "nbaVersionId" TEXT,
    "screen" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "confidence" REAL NOT NULL,
    "guardrailFlags" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIArtifact_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIArtifact_nbaVersionId_fkey" FOREIGN KEY ("nbaVersionId") REFERENCES "NbaVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Nba_name_key" ON "Nba"("name");

-- CreateIndex
CREATE INDEX "NbaVersion_nbaId_version_idx" ON "NbaVersion"("nbaId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NbaVersion_nbaId_version_key" ON "NbaVersion"("nbaId", "version");

-- CreateIndex
CREATE INDEX "CommTemplate_nbaVersionId_channel_idx" ON "CommTemplate"("nbaVersionId", "channel");

-- CreateIndex
CREATE INDEX "LegalApproval_nbaVersionId_status_idx" ON "LegalApproval"("nbaVersionId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_nbaVersionId_createdAt_idx" ON "AuditLog"("nbaVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_customerId_type_createdAt_idx" ON "Event"("customerId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "OfferAssignment_customerId_nbaId_status_idx" ON "OfferAssignment"("customerId", "nbaId", "status");

-- CreateIndex
CREATE INDEX "ArbitrationScore_customerId_createdAt_idx" ON "ArbitrationScore"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "AIArtifact_nbaVersionId_screen_createdAt_idx" ON "AIArtifact"("nbaVersionId", "screen", "createdAt");
