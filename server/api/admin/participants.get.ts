import { defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = (query.search as string) || "";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { school: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const participants = await prisma.participant.findMany({
    where,
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
