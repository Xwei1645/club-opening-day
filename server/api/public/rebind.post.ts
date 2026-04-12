import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";

const schema = z.object({
  oldFingerprint: z.string().min(1),
  newFingerprint: z.string().min(1),
});

function isHashedFingerprint(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));

  const oldHash = isHashedFingerprint(body.oldFingerprint)
    ? body.oldFingerprint.toLowerCase()
    : normalizeFingerprintHash(body.oldFingerprint);
  const newHash = normalizeFingerprintHash(body.newFingerprint);

  const participant = await prisma.participant.findUnique({
    where: { fingerprintHash: oldHash },
  });

  if (!participant) {
    throw createError({
      statusCode: 404,
      statusMessage: "未找到该指纹对应的抽奖记录",
    });
  }

  const existingNew = await prisma.participant.findUnique({
    where: { fingerprintHash: newHash },
  });

  if (existingNew) {
    throw createError({
      statusCode: 400,
      statusMessage: "新指纹已存在抽奖记录，无法绑定",
    });
  }

  await prisma.participant.update({
    where: { fingerprintHash: oldHash },
    data: { fingerprintHash: newHash },
  });

  return { ok: true, participant: { name: participant.name, school: participant.school } };
});
