import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const blacklist = await prisma.blacklist.findMany({
    orderBy: { createdAt: "desc" },
  });

  return blacklist.map((item) => ({
    id: item.id,
    fingerprintHash: item.fingerprintHash,
    reason: item.reason,
    createdAt: item.createdAt,
    name: item.name,
    school: item.school,
  }));
});
