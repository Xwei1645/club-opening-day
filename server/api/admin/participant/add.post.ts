import { createError, defineEventHandler, readBody } from "h3";
import { z } from "zod";
import { prisma } from "../../../utils/prisma";
import { generateUniqueRecoverCode } from "../../../utils/recover-code";
import { requestMeta } from "../../../utils/request-meta";
import { ensureDrawConfig, generateTicketCode } from "../../../utils/draw";

const chineseRegex = /^[\u4e00-\u9fa5]+$/;

const addSchema = z.object({
    name: z
        .string()
        .trim()
        .regex(chineseRegex, "姓名必须为中文")
        .min(2, "姓名需要2-4个中文字")
        .max(4, "姓名需要2-4个中文字"),
    school: z
        .string()
        .trim()
        .regex(chineseRegex, "学校名称必须为中文")
        .min(3, "学校名称需要至少3个字"),
});

export default defineEventHandler(async (event) => {
    const body = addSchema.parse(await readBody(event));
    const cfg = await ensureDrawConfig();

    // 生成唯一的随机指纹哈希
    const fingerprintHash = `ADMIN_MANUAL_${Math.random().toString(36).substring(2)}_${Date.now()}`;

    const { ip, userAgent } = requestMeta(event);

    try {
        const recoverCode = await generateUniqueRecoverCode();

        const isWinner = cfg.drawStatus === "DONE";
        const drawResult = isWinner ? "WIN" : "PENDING";
        const forceResult = "WIN";
        const ticketCode = generateTicketCode();

        const participant = await prisma.participant.create({
            data: {
                name: body.name,
                school: body.school,
                fingerprintHash,
                recoverCode,
                ip,
                userAgent: `${userAgent} (Admin Manual Entry)`,
                drawResult,
                forceResult,
                ...(isWinner ? {
                    ticket: {
                        create: {
                            ticketCode,
                            qrPayload: ticketCode,
                            expiresAt: cfg.ticketExpireAt,
                        }
                    }
                } : {})
            },
            include: {
                ticket: true,
            }
        });

        return { ok: true, participant };
    } catch (error) {
        console.error("Failed to add participant manually:", error);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error",
        });
    }
});
