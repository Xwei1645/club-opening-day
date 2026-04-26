import { defineEventHandler, getQuery, createError } from "h3";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
    const admin = event.context.admin;
    if (!admin) {
        throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    const query = getQuery(event);
    const limit = Math.min(Number(query.limit) || 200, 500);

    const where: any = {};

    if (admin.role === "INSPECTOR") {
        where.inspectorId = admin.id;
    }
    else if (query.inspectorId) {
        where.inspectorId = String(query.inspectorId);
    }

    const logs = await prisma.scanLog.findMany({
        where,
        orderBy: {
            scannedAt: "desc",
        },
        take: limit,
        include: {
            ticket: {
                include: {
                    participant: {
                        select: {
                            name: true,
                            school: true,
                        },
                    },
                },
            },
            inspector: {
                select: {
                    name: true,
                },
            },
        },
    });

    return logs.map((log) => ({
        id: log.id,
        ticketCode: log.ticket?.ticketCode || "N/A",
        result: log.result,
        scannedAt: log.scannedAt,
        operator: log.operator || log.inspector?.name || "System",
        participant: log.ticket?.participant || null,
    }));
});
