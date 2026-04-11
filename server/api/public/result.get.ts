import { createError, defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";
import { ensureDrawConfig, syncExpiredTickets } from "../../utils/draw";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const raw = String(query.fingerprintHash || "").trim();
  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: "fingerprintHash is required.",
    });
  }

  await syncExpiredTickets();
  const cfg = await ensureDrawConfig();
  const participant = await prisma.participant.findUnique({
    where: { fingerprintHash: normalizeFingerprintHash(raw) },
    include: { ticket: true },
  });

  if (!participant) {
    throw createError({
      statusCode: 404,
      statusMessage: "Participant not found.",
    });
  }

  if (cfg.drawStatus !== "DONE") {
    return {
      stage: "waiting",
      drawAt: cfg.drawAt,
      publishStatus: cfg.publishStatus,
    };
  }

  if (cfg.publishStatus === "HIDDEN") {
    return {
      stage: "hidden",
      drawAt: cfg.drawAt,
      resultGeneratedAt: cfg.resultGeneratedAt,
    };
  }

  if (participant.drawResult === "WIN" && participant.ticket) {
    return {
      stage: "win",
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

  return { stage: "lose" };
});
