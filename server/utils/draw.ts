import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

const DEFAULT_WINNER_COUNT = 100;

export async function ensureDrawConfig() {
  const existing = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  if (existing) {
    return existing;
  }

  const now = new Date();
  const drawAt = new Date(now.getTime() + 60 * 60 * 1000);
  const ticketExpireAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return prisma.drawConfig.create({
    data: {
      id: 1,
      drawAt,
      drawStatus: "PENDING",
      publishStatus: "HIDDEN",
      ticketExpireAt,
      winnerCount: DEFAULT_WINNER_COUNT,
    },
  });
}

export async function runDrawIfNeeded() {
  const cfg = await ensureDrawConfig();
  const now = new Date();
  if (cfg.drawStatus === "DONE" || now < cfg.drawAt) {
    return { executed: false };
  }

  return prisma.$transaction(async (tx: any) => {
    const current = await tx.drawConfig.findUnique({ where: { id: 1 } });
    if (
      !current ||
      current.drawStatus === "DONE" ||
      new Date() < current.drawAt
    ) {
      return { executed: false };
    }

    const participants = await tx.participant.findMany({
      where: { drawResult: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    const winnerCount = Math.min(current.winnerCount, shuffled.length);
    const winners = shuffled.slice(0, winnerCount);
    const winnerIds = new Set(winners.map((item) => item.id));

    if (winners.length > 0) {
      await tx.participant.updateMany({
        where: { id: { in: winners.map((w) => w.id) } },
        data: { drawResult: "WIN" },
      });
    }

    const losers = participants
      .filter((p: any) => !winnerIds.has(p.id))
      .map((p: any) => p.id);
    if (losers.length > 0) {
      await tx.participant.updateMany({
        where: { id: { in: losers } },
        data: { drawResult: "LOSE" },
      });
    }

    const baseUrl = useRuntimeConfig().public.baseUrl;
    const nowTime = new Date();

    for (const winner of winners) {
      const code = randomUUID().replace(/-/g, "");
      await tx.ticket.create({
        data: {
          participantId: winner.id,
          ticketCode: code,
          qrPayload: `${baseUrl}/ticket?code=${code}`,
          status: "VALID",
          issuedAt: nowTime,
          expiresAt: current.ticketExpireAt,
        },
      });
    }

    await tx.drawConfig.update({
      where: { id: 1 },
      data: {
        drawStatus: "DONE",
        resultGeneratedAt: nowTime,
      },
    });

    return { executed: true, winnerCount: winners.length };
  });
}

export async function syncExpiredTickets() {
  const now = new Date();
  await prisma.ticket.updateMany({
    where: {
      status: "VALID",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
}
