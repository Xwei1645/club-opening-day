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

  const cfg = await prisma.drawConfig.findUnique({ where: { id: 1 } });
  const winnerCount = cfg?.winnerCount || 10;
  const totalCount = await prisma.participant.count();
  const currentForcedWin = await prisma.participant.count({
    where: { forceResult: "WIN", id: { not: body.participantId } },
  });
  const currentForcedLose = await prisma.participant.count({
    where: { forceResult: "LOSE", id: { not: body.participantId } },
  });

  if (body.forceResult === "WIN") {
    if (currentForcedWin + 1 > winnerCount) {
      throw createError({
        statusCode: 400,
        statusMessage: `强制中奖人数(${currentForcedWin + 1})超过设定的中奖人数(${winnerCount})`,
      });
    }
  }

  if (body.forceResult === "LOSE") {
    const maxLoseCount = totalCount - winnerCount;
    if (currentForcedLose + 1 > maxLoseCount) {
      throw createError({
        statusCode: 400,
        statusMessage: `必不中人数(${currentForcedLose + 1})超过最大可设置数量(${maxLoseCount}人)，会导致中奖人数不足`,
      });
    }
  }

  await prisma.participant.update({
    where: { id: body.participantId },
    data: { forceResult: body.forceResult },
  });

  return { ok: true };
});
