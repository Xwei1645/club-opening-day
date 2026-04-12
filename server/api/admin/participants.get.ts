import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const participants = await prisma.participant.findMany({
    select: {
      id: true,
      name: true,
      school: true,
      drawResult: true,
      forceResult: true,
      createdAt: true,
      ip: true,
      userAgent: true,
      fingerprintHash: true,
      ticket: {
        select: {
          ticketCode: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return participants;
});
