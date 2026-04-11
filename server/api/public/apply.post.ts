import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { normalizeFingerprintHash } from '../../utils/fingerprint'
import { ensureDrawConfig } from '../../utils/draw'
import { requestMeta } from '../../utils/request-meta'

const applySchema = z.object({
  name: z.string().trim().min(1).max(60),
  school: z.string().trim().min(1).max(120),
  fingerprintHash: z.string().trim().min(8).max(200)
})

export default defineEventHandler(async (event) => {
  const body = applySchema.parse(await readBody(event))
  const cfg = await ensureDrawConfig()
  if (new Date() >= cfg.drawAt || cfg.drawStatus === 'DONE') {
    throw createError({ statusCode: 400, statusMessage: 'Registration is closed.' })
  }

  const fingerprintHash = normalizeFingerprintHash(body.fingerprintHash)
  const exists = await prisma.participant.findUnique({ where: { fingerprintHash } })
  if (exists) {
    return { ok: true, duplicate: true }
  }

  const { ip, userAgent } = requestMeta(event)
  const participant = await prisma.participant.create({
    data: {
      name: body.name,
      school: body.school,
      fingerprintHash,
      ip,
      userAgent
    }
  })

  return { ok: true, duplicate: false, id: participant.id }
})
