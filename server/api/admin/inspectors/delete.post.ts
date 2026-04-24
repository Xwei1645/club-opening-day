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
    if (!body.id) {
        throw createError({
            statusCode: 400,
            statusMessage: "Inspector ID is required.",
        });
    }

    return await prisma.inspector.delete({
        where: { id: body.id },
    });
});
