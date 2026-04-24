import { defineEventHandler, createError, readBody } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
    const authAdmin = event.context.admin;

    if (authAdmin?.role === "INSPECTOR" || authAdmin?.role === "SUPER_ADMIN") {
        return {
            ok: true,
            role: authAdmin.role,
            name: authAdmin.name || "Admin"
        };
    }

    throw createError({
        statusCode: 401,
        statusMessage: "令牌无效或权限不足",
    });
});
