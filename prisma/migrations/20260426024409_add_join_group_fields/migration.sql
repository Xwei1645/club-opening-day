-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "hasJoinedGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinedAt" TIMESTAMP(3);
