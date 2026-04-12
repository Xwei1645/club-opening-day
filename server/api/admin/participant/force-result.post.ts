import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../../utils/prisma";

const schema = z.object({
  participantId: z.string(),
  forceResult: z.enum(["WIN", "LOSE"]).nullable(),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));

  const participant = await prisma.participant.findUnique({
    where: { id: body.participantId },
  });

  if (!participant) {
    throw createError({
      statusCode: 404,
      statusMessage: "Participant not found.",
    });
  }

  if (body.forceResult === "WIN") {
    const cfg = await prisma.drawConfig.findUnique({ where: { id: 1 } });
    const forcedWinCount = await prisma.participant.count({
      where: { forceResult: "WIN", id: { not: body.participantId } },
    });
    const winnerCount = cfg?.winnerCount || 10;
    if (forcedWinCount + 1 > winnerCount) {
      throw createError({
        statusCode: 400,
        statusMessage: `强制中奖人数(${forcedWinCount + 1})超过设定的中奖人数(${winnerCount})`,
      });
    }
  }

  await prisma.participant.update({
    where: { id: body.participantId },
    data: { forceResult: body.forceResult },
  });

  return { ok: true };
});
