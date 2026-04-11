import { createError, defineEventHandler, readBody } from "h3";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";
import { ensureDrawConfig } from "../../utils/draw";
import { requestMeta } from "../../utils/request-meta";
import { checkIpLocation } from "../../utils/ip-check";

const applySchema = z.object({
  name: z.string().trim().min(1).max(60),
  school: z.string().trim().min(1).max(120),
  fingerprintHash: z.string().trim().min(8).max(200),
});

export default defineEventHandler(async (event) => {
  const body = applySchema.parse(await readBody(event));
  const cfg = await ensureDrawConfig();
  if (new Date() >= cfg.drawAt || cfg.drawStatus === "DONE") {
    throw createError({
      statusCode: 400,
      statusMessage: "Registration is closed.",
    });
  }

  const fingerprintHash = normalizeFingerprintHash(body.fingerprintHash);
  const { ip, userAgent } = requestMeta(event);

  const blacklisted = await prisma.blacklist.findUnique({
    where: { fingerprintHash },
  });
  if (blacklisted) {
    throw createError({
      statusCode: 403,
      statusMessage: "您已被禁止参与本次活动。",
    });
  }

  if (cfg.ipCheckEnabled) {
    const ipCheck = await checkIpLocation(ip);
    if (!ipCheck.allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: `本活动仅限温州市用户参与。检测到您的位置：${ipCheck.city || ipCheck.region || "未知"}`,
      });
    }
  }

  try {
    const participant = await prisma.participant.create({
      data: {
        name: body.name,
        school: body.school,
        fingerprintHash,
        ip,
        userAgent,
      },
    });

    return { ok: true, duplicate: false, id: participant.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, duplicate: true };
    }

    throw error;
  }
});
