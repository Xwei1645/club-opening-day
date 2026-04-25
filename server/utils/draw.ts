import { prisma } from "./prisma";
import { randomInt } from "node:crypto";

const DEFAULT_WINNER_COUNT = 100;

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export { generateTicketCode };

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

function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const temp = result[i];
    result[i] = result[j]!;
    result[j] = temp!;
  }
  return result;
}

interface DrawResult {
  ok: boolean;
  winnerCount: number;
  totalParticipants: number;
}

export async function executeDraw(tx: any, cfg: any): Promise<DrawResult> {
  const participants = await tx.participant.findMany({
    where: { drawResult: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (participants.length === 0) {
    throw new Error("No participants to draw.");
  }

  const forcedWinners = participants.filter(
    (p: any) => p.forceResult === "WIN",
  );
  const forcedLosers = participants.filter(
    (p: any) => p.forceResult === "LOSE",
  );
  const normalParticipants = participants.filter(
    (p: any) => p.forceResult === null,
  );

  const forcedWinnerIds = new Set(forcedWinners.map((p: any) => p.id));
  const forcedLoserIds = new Set(forcedLosers.map((p: any) => p.id));

  const remainingWinnerSlots = Math.max(
    0,
    cfg.winnerCount - forcedWinners.length,
  );

  const shuffled = secureShuffle(normalParticipants);
  const normalWinners = shuffled.slice(0, remainingWinnerSlots);
  const normalWinnerIds = new Set(normalWinners.map((p: any) => p.id));

  const allWinners = [...forcedWinners, ...normalWinners];

  const now = new Date();

  if (forcedWinners.length > 0) {
    await tx.participant.updateMany({
      where: { id: { in: [...forcedWinnerIds] } },
      data: { drawResult: "WIN" },
    });
  }

  if (normalWinners.length > 0) {
    await tx.participant.updateMany({
      where: { id: { in: [...normalWinnerIds] } },
      data: { drawResult: "WIN" },
    });
  }

  const loserIds = normalParticipants
    .filter((p: any) => !normalWinnerIds.has(p.id))
    .map((p: any) => p.id);

  if (forcedLosers.length > 0) {
    loserIds.push(...forcedLoserIds);
  }

  if (loserIds.length > 0) {
    await tx.participant.updateMany({
      where: { id: { in: loserIds } },
      data: { drawResult: "LOSE" },
    });
  }

  for (const winner of allWinners) {
    const code = generateTicketCode();
    await tx.ticket.create({
      data: {
        participantId: winner.id,
        ticketCode: code,
        qrPayload: code,
        status: "VALID",
        issuedAt: now,
        expiresAt: cfg.ticketExpireAt,
      },
    });
  }

  await tx.drawConfig.update({
    where: { id: 1 },
    data: {
      drawStatus: "DONE",
      resultGeneratedAt: now,
    },
  });

  return {
    ok: true,
    winnerCount: allWinners.length,
    totalParticipants: participants.length,
  };
}

export async function runDrawIfNeeded() {
  const cfg = await ensureDrawConfig();
  const now = new Date();
  
  if (now < cfg.drawAt) {
    return { executed: false };
  }

  // 如果已经时间到了且状态是 PENDING，则执行开奖并公开
  if (cfg.drawStatus === "PENDING") {
    return prisma.$transaction(async (tx: any) => {
      const current = await tx.drawConfig.findUnique({ where: { id: 1 } });
      if (
        !current ||
        current.drawStatus === "DONE" ||
        new Date() < current.drawAt
      ) {
        return { executed: false };
      }

      const result = await executeDraw(tx, current);

      await tx.drawConfig.update({
        where: { id: 1 },
        data: { publishStatus: "PUBLIC" },
      });

      return { executed: true, ...result };
    });
  }

  // 如果时间到了且已经开过奖 (DONE) 但还没公开 (HIDDEN)，则执行公开
  if (cfg.drawStatus === "DONE" && cfg.publishStatus === "HIDDEN") {
    await prisma.drawConfig.update({
      where: { id: 1 },
      data: { publishStatus: "PUBLIC" },
    });
    return { executed: true, action: "PUBLISHED_ONLY" };
  }

  return { executed: false };
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
