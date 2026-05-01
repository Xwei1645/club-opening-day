-- AlterTable
ALTER TABLE "DrawConfig" ADD COLUMN     "ticketNoStart" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "ticketNo" INTEGER;

-- CreateIndex
CREATE INDEX "Ticket_ticketNo_idx" ON "Ticket"("ticketNo");
