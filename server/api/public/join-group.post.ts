import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../utils/prisma";

const joinGroupSchema = z.object({
    recoverCode: z.string().trim().length(6),
});

export default defineEventHandler(async (event) => {
    const body = joinGroupSchema.parse(await readBody(event));

    const participant = await prisma.participant.findUnique({
        where: { recoverCode: body.recoverCode },
    });

    if (!participant) {
        throw createError({
            statusCode: 404,
            statusMessage: "找不到该参与者。",
        });
    }

    if (participant.drawResult !== "WIN" && participant.forceResult !== "WIN") {
        throw createError({
            statusCode: 403,
            statusMessage: "非中奖用户无法执行此操作。",
        });
    }

    return await prisma.participant.update({
        where: { id: participant.id },
        data: {
            hasJoinedGroup: true,
            joinedAt: new Date(),
        },
        select: {
            id: true,
            hasJoinedGroup: true,
            joinedAt: true,
        },
    });
});
