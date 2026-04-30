import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const winners = await prisma.participant.findMany({
    where: { drawResult: "WIN" },
    select: {
      id: true,
      name: true,
      school: true,
      createdAt: true,
      ip: true,
      userAgent: true,
      fingerprintHash: true,
      recoverCode: true,
      hasJoinedGroup: true,
      joinedAt: true,
      forceResult: true,
      ticket: {
        select: {
          ticketCode: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
          usedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return winners;
});
