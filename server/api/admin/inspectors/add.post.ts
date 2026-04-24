import { defineEventHandler, readBody, createError } from "h3";
import { prisma } from "../../../utils/prisma";

export default defineEventHandler(async (event) => {
    if (event.context.admin?.role !== "SUPER_ADMIN") {
        throw createError({
            statusCode: 403,
            statusMessage: "Forbidden: Super admin only.",
        });
    }

    const body = await readBody(event);
    if (!body.name || !body.token) {
        throw createError({
            statusCode: 400,
            statusMessage: "Name and token are required.",
        });
    }

    return await prisma.inspector.upsert({
        where: { name: body.name },
        update: { token: body.token, isActive: true },
        create: { name: body.name, token: body.token },
    });
});
