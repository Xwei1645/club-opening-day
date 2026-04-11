import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const winners = await prisma.participant.findMany({
    where: { drawResult: "WIN" },
    include: {
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
