import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { requestMeta } from "../../utils/request-meta";
import { syncExpiredTickets } from "../../utils/draw";
import { sseManager } from "../../utils/sse";

const schema = z.object({
  ticketCode: z
    .string()
    .trim()
    .min(8)
    .transform((v) => v.replace(/\s/g, "")),
  operator: z.string().trim().max(80).optional(),
});

export default defineEventHandler(async (event) => {
  const { ticketCode, operator } = schema.parse(await readBody(event));
  const { ip, userAgent } = requestMeta(event);
  await syncExpiredTickets();

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    include: { participant: true },
  });

  if (!ticket) {
    await prisma.scanLog.create({
      data: {
        ticketId: null,
        result: "INVALID",
        operator,
        ip,
        userAgent,
      },
    });
    throw createError({ statusCode: 404, statusMessage: "Invalid ticket." });
  }

  const participantInfo = {
    name: ticket.participant.name,
    school: ticket.participant.school,
  };

  if (ticket.status === "USED") {
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: "USED",
        operator,
        ip,
        userAgent,
      },
    });
    return { ok: false, status: "used", participant: participantInfo };
  }

  if (ticket.status === "EXPIRED" || ticket.expiresAt < new Date()) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "EXPIRED" },
    });
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: "EXPIRED",
        operator,
        ip,
        userAgent,
      },
    });
    return { ok: false, status: "expired", participant: participantInfo };
  }

  const updated = await prisma.ticket.updateMany({
    where: {
      id: ticket.id,
      status: "VALID",
    },
    data: {
      status: "USED",
      usedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: "USED",
        operator,
        ip,
        userAgent,
      },
    });
    return { ok: false, status: "used", participant: participantInfo };
  }

  await prisma.scanLog.create({
    data: {
      ticketId: ticket.id,
      result: "SUCCESS",
      operator,
      ip,
      userAgent,
    },
  });

  sseManager.notifyVerify(ticketCode);

  return { ok: true, status: "success", participant: participantInfo };
});
