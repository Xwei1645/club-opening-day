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
    .transform((v) => v.replace(/\s/g, "").toUpperCase()),
  operator: z.string().trim().max(80).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { ticketCode, operator: bodyOperator } = schema.parse(body);
  const { ip, userAgent } = requestMeta(event);
  await syncExpiredTickets();

  const authAdmin = event.context.admin;
  const inspectorId = authAdmin?.role === "INSPECTOR" ? authAdmin.id : null;
  const operator = authAdmin?.name || bodyOperator || "System";

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    include: { participant: true },
  });

  if (!ticket) {
    await prisma.scanLog.create({
      data: {
        ticketId: null,
        result: "INVALID",
        inspectorId,
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
        inspectorId,
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
        inspectorId,
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
        inspectorId,
        operator,
        ip,
        userAgent,
      },
    });
    return { ok: false, status: "used", participant: participantInfo };
  }

  // Generate ticket number
  const finalTicket = await prisma.$transaction(async (tx) => {
    // Check if it already has a number (shouldn't happen with updateMany check above, but for safety)
    const t = await tx.ticket.findUnique({ where: { id: ticket.id } });
    if (t?.ticketNo) return t;

    const config = await tx.drawConfig.findUnique({ where: { id: 1 } });
    const startNo = config?.ticketNoStart ?? 1;

    const maxTicket = await tx.ticket.findFirst({
      where: { ticketNo: { not: null } },
      orderBy: { ticketNo: "desc" },
    });

    const nextNo = maxTicket?.ticketNo ? maxTicket.ticketNo + 1 : startNo;

    return tx.ticket.update({
      where: { id: ticket.id },
      data: { ticketNo: nextNo },
    });
  });

  await prisma.scanLog.create({
    data: {
      ticketId: ticket.id,
      result: "SUCCESS",
      inspectorId,
      operator,
      ip,
      userAgent,
    },
  });

  sseManager.notifyVerify(ticketCode, finalTicket.ticketNo || undefined);

  return {
    ok: true,
    status: "success",
    participant: participantInfo,
    ticketNo: finalTicket.ticketNo,
  };
});
