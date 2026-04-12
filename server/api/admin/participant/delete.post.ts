import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../../utils/prisma";

const schema = z.object({
  participantId: z.string(),
  addToBlacklist: z.boolean().optional(),
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

  await prisma.$transaction(async (tx) => {
    if (body.addToBlacklist) {
      await tx.blacklist.upsert({
        where: { fingerprintHash: participant.fingerprintHash },
        create: {
          fingerprintHash: participant.fingerprintHash,
          name: participant.name,
          school: participant.school,
          reason: "Deleted by admin",
        },
        update: {
          name: participant.name,
          school: participant.school,
        },
      });
    }

    await tx.participant.delete({
      where: { id: body.participantId },
    });
  });

  return { ok: true };
});
