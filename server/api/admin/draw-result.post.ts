import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  await prisma.$transaction(async (tx) => {
    await tx.scanLog.deleteMany({});
    await tx.ticket.deleteMany({});
    await tx.participant.updateMany({
      data: { drawResult: "PENDING" },
    });
    await tx.drawConfig.update({
      where: { id: 1 },
      data: {
        drawStatus: "PENDING",
        publishStatus: "HIDDEN",
        resultGeneratedAt: null,
      },
    });
  });

  return { ok: true };
});
