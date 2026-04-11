import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  return prisma.drawConfig.update({
    where: { id: 1 },
    data: { publishStatus: "PUBLIC" },
  });
});
