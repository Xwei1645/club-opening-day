import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";

const recoverSchema = z.object({
  recoverCode: z.string().trim().length(6),
});

export default defineEventHandler(async (event) => {
  const body = recoverSchema.parse(await readBody(event));
  const recoverCode = body.recoverCode.toUpperCase();

  const participant = await prisma.participant.findUnique({
    where: { recoverCode },
    select: {
      id: true,
      name: true,
      school: true,
      recoverCode: true,
    },
  });

  if (!participant) {
    throw createError({
      statusCode: 404,
      statusMessage: "找回码不存在",
    });
  }

  return {
    ok: true,
    participant: {
      id: participant.id,
      name: participant.name,
      school: participant.school,
      recoverCode: participant.recoverCode,
    },
  };
});
