import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const blacklist = await prisma.blacklist.findMany({
    orderBy: { createdAt: "desc" },
  });

  const result = await Promise.all(
    blacklist.map(async (item) => {
      const participant = await prisma.participant.findFirst({
        where: { fingerprintHash: item.fingerprintHash },
        select: { name: true, school: true },
      });
      return {
        id: item.id,
        fingerprintHash: item.fingerprintHash,
        reason: item.reason,
        createdAt: item.createdAt,
        name: participant?.name || null,
        school: participant?.school || null,
      };
    })
  );

  return result;
});
