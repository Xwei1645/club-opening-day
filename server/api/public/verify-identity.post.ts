import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";

const schema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(4),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));

  const participant = await prisma.participant.findUnique({
    where: { id: body.id },
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
      statusMessage: "参与者不存在",
    });
  }

  if (participant.name !== body.name) {
    throw createError({
      statusCode: 403,
      statusMessage: "姓名验证失败",
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
