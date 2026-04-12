import { defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";

const schema = z.object({
  fingerprintHash: z.string().trim().min(8).max(200),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));
  const fingerprintHash = normalizeFingerprintHash(body.fingerprintHash);

  const participant = await prisma.participant.findUnique({
    where: { fingerprintHash },
  });

  if (!participant) {
    return { success: false, message: "未找到参与记录" };
  }

  await prisma.participant.delete({
    where: { fingerprintHash },
  });

  return { success: true, message: "已退出活动" };
});
