import { defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = (query.search as string) || "";
  const duplicates = query.duplicates === "true";

  let where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" as const } },
      { school: { contains: search, mode: "insensitive" as const } },
      { recoverCode: { equals: search.toUpperCase() } },
    ];
  }

  if (duplicates) {
    const duplicateNames = await prisma.participant.groupBy({
      by: ["name"],
      having: {
        name: { _count: { gt: 1 } },
      },
    });

    const names = duplicateNames.map((d) => d.name);
    where.name = { in: names };
  }

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
      recoverCode: true,
      ticket: {
        select: {
          ticketCode: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
        },
      },
    },
    orderBy: duplicates
      ? [{ name: "asc" }, { createdAt: "desc" }]
      : { createdAt: "desc" },
  });

  return participants;
});
