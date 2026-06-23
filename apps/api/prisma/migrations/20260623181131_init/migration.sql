-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "purpose" TEXT,
    "providerName" TEXT NOT NULL,
    "messageId" TEXT,
    "errorMessage" TEXT,
    "userId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_tenantId_timestamp_idx" ON "notification_logs"("tenantId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "notification_logs_tenantId_channel_verb_idx" ON "notification_logs"("tenantId", "channel", "verb");

-- CreateIndex
CREATE INDEX "notification_logs_userId_timestamp_idx" ON "notification_logs"("userId", "timestamp" DESC);

