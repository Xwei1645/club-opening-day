import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../../utils/prisma";

const schema = z.object({
  id: z.string(),
});

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event));

  await prisma.blacklist.delete({
    where: { id: body.id },
  });

  return { ok: true };
});
