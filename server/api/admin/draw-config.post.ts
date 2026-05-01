import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { ensureDrawConfig } from "../../utils/draw";

const schema = z.object({
  drawAt: z.string().datetime(),
  ticketExpireAt: z.string().datetime(),
  winnerCount: z.number().int().min(1).max(100000),
  publishStatus: z.enum(["HIDDEN", "PUBLIC"]).optional(),
  ipCheckEnabled: z.boolean().optional(),
  wechatQrCodeUrl: z.string().max(500).nullable().optional(),
  ticketNoStart: z.number().int().min(0).max(999).optional(),
});

export default defineEventHandler(async (event) => {
  await ensureDrawConfig();
  const body = schema.parse(await readBody(event));
  const drawAt = new Date(body.drawAt);
  const ticketExpireAt = new Date(body.ticketExpireAt);

  if (ticketExpireAt <= drawAt) {
    throw createError({
      statusCode: 400,
      statusMessage: "ticketExpireAt must be after drawAt.",
    });
  }

  return prisma.drawConfig.update({
    where: { id: 1 },
    data: {
      drawAt,
      ticketExpireAt,
      winnerCount: body.winnerCount,
      publishStatus: body.publishStatus,
      ipCheckEnabled: body.ipCheckEnabled,
      wechatQrCodeUrl: body.wechatQrCodeUrl,
      ticketNoStart: body.ticketNoStart,
    },
  });
});
