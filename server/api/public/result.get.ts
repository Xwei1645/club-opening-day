import { defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";
import { ensureDrawConfig, syncExpiredTickets } from "../../utils/draw";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const recoverCode = String(query.recoverCode || "").trim().toUpperCase();
  if (!recoverCode || recoverCode.length !== 6) {
    return { participated: false };
  }

  await syncExpiredTickets();
  const cfg = await ensureDrawConfig();
  const participant = await prisma.participant.findUnique({
    where: { recoverCode },
    include: { ticket: true },
  });

  if (!participant) {
    return { participated: false };
  }

  if (cfg.drawStatus !== "DONE") {
    return {
      participated: true,
      stage: "waiting",
      drawAt: cfg.drawAt,
      publishStatus: cfg.publishStatus,
      name: participant.name,
      school: participant.school,
      recoverCode: participant.recoverCode,
    };
  }

  if (cfg.publishStatus === "HIDDEN") {
    return {
      participated: true,
      stage: "hidden",
      drawAt: cfg.drawAt,
      resultGeneratedAt: cfg.resultGeneratedAt,
      name: participant.name,
      school: participant.school,
      recoverCode: participant.recoverCode,
    };
  }

  if (participant.drawResult === "WIN" && participant.ticket) {
    return {
      participated: true,
      stage: "win",
      name: participant.name,
      school: participant.school,
      recoverCode: participant.recoverCode,
      ticket: {
        ticketCode: participant.ticket.ticketCode,
        qrPayload: participant.ticket.qrPayload,
        status: participant.ticket.status,
        issuedAt: participant.ticket.issuedAt,
        expiresAt: participant.ticket.expiresAt,
        usedAt: participant.ticket.usedAt,
      },
    };
  }

  return {
    participated: true,
    stage: "lose",
    name: participant.name,
    school: participant.school,
    recoverCode: participant.recoverCode,
  };
});
