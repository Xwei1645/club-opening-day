import { defineEventHandler } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const blacklist = await prisma.blacklist.findMany({
    orderBy: { createdAt: "desc" },
  });
  return blacklist;
});
