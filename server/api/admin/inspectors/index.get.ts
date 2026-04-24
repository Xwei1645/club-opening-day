import { defineEventHandler, createError } from "h3";
import { prisma } from "../../../utils/prisma";

export default defineEventHandler(async (event) => {
    if (event.context.admin?.role !== "SUPER_ADMIN") {
        throw createError({
            statusCode: 403,
            statusMessage: "Forbidden: Super admin only.",
        });
    }

    return await prisma.inspector.findMany({
        orderBy: { createdAt: "desc" },
    });
});
