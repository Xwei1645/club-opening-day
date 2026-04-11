import { defineEventHandler, createError } from "h3";
import { prisma } from "../../utils/prisma";
import { ensureDrawConfig } from "../../utils/draw";

export default defineEventHandler(async () => {
  const cfg = await ensureDrawConfig();

  if (cfg.drawStatus === "DONE") {
    throw createError({
      statusCode: 400,
      statusMessage: "Draw already completed.",
    });
  }

  const participants = await prisma.participant.findMany({
    where: { drawResult: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (participants.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No participants to draw.",
    });
  }

  const shuffled = participants
    .map((p) => ({ p, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ p }) => p);

  const winnerCount = Math.min(cfg.winnerCount, shuffled.length);
  const winners = shuffled.slice(0, winnerCount);
  const winnerIds = new Set(winners.map((item) => item.id));

  const baseUrl = useRuntimeConfig().public.baseUrl;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (winners.length > 0) {
      await tx.participant.updateMany({
        where: { id: { in: winners.map((w) => w.id) } },
        data: { drawResult: "WIN" },
      });

      for (const winner of winners) {
        const code = crypto.randomUUID().replace(/-/g, "");
        await tx.ticket.create({
          data: {
            participantId: winner.id,
            ticketCode: code,
            qrPayload: `${baseUrl}/ticket?code=${code}`,
            status: "VALID",
            issuedAt: now,
            expiresAt: cfg.ticketExpireAt,
          },
        });
      }
    }

    const losers = participants
      .filter((p) => !winnerIds.has(p.id))
      .map((p) => p.id);
    if (losers.length > 0) {
      await tx.participant.updateMany({
        where: { id: { in: losers } },
        data: { drawResult: "LOSE" },
      });
    }

    await tx.drawConfig.update({
      where: { id: 1 },
      data: {
        drawStatus: "DONE",
        resultGeneratedAt: now,
      },
    });
  });

  return {
    ok: true,
    winnerCount: winners.length,
    totalParticipants: participants.length,
  };
});
