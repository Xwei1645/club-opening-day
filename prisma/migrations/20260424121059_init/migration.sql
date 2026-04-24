-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('HIDDEN', 'PUBLIC');

-- CreateEnum
CREATE TYPE "DrawResult" AS ENUM ('PENDING', 'WIN', 'LOSE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('SUCCESS', 'USED', 'EXPIRED', 'INVALID');

-- CreateTable
CREATE TABLE "DrawConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "drawAt" TIMESTAMP(3) NOT NULL,
    "drawStatus" "DrawStatus" NOT NULL DEFAULT 'PENDING',
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'HIDDEN',
    "resultGeneratedAt" TIMESTAMP(3),
    "ticketExpireAt" TIMESTAMP(3) NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "ipCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wechatQrCodeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "recoverCode" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "drawResult" "DrawResult" NOT NULL DEFAULT 'PENDING',
    "forceResult" "DrawResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "result" "ScanResult" NOT NULL,
    "operator" TEXT,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "name" TEXT,
    "school" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_recoverCode_key" ON "Participant"("recoverCode");

-- CreateIndex
CREATE INDEX "Participant_drawResult_idx" ON "Participant"("drawResult");

-- CreateIndex
CREATE INDEX "Participant_forceResult_idx" ON "Participant"("forceResult");

-- CreateIndex
CREATE INDEX "Participant_recoverCode_idx" ON "Participant"("recoverCode");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_participantId_key" ON "Ticket"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_expiresAt_idx" ON "Ticket"("expiresAt");

-- CreateIndex
CREATE INDEX "ScanLog_scannedAt_idx" ON "ScanLog"("scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_fingerprintHash_key" ON "Blacklist"("fingerprintHash");

-- CreateIndex
CREATE INDEX "Blacklist_fingerprintHash_idx" ON "Blacklist"("fingerprintHash");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
