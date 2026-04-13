import { createError, defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";
import { ensureDrawConfig, executeDraw } from "../../utils/draw";

export default defineEventHandler(async () => {
  const cfg = await ensureDrawConfig();

  if (cfg.drawStatus === "DONE") {
    throw createError({
      statusCode: 400,
      statusMessage: "Draw already completed.",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return executeDraw(tx, cfg);
    });
    return result;
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      statusMessage: e.message || "Draw failed.",
    });
  }
});
