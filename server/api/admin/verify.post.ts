import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requestMeta } from '../../utils/request-meta'
import { syncExpiredTickets } from '../../utils/draw'

const schema = z.object({
  ticketCode: z.string().trim().min(8),
  operator: z.string().trim().max(80).optional()
})

export default defineEventHandler(async (event) => {
  const { ticketCode, operator } = schema.parse(await readBody(event))
  const { ip, userAgent } = requestMeta(event)
  await syncExpiredTickets()

  const ticket = await prisma.ticket.findUnique({ where: { ticketCode } })
  if (!ticket) {
    await prisma.scanLog.create({
      data: {
        ticketId: null,
        result: 'INVALID',
        operator,
        ip,
        userAgent
      }
    })
    throw createError({ statusCode: 404, statusMessage: 'Invalid ticket.' })
  }

  if (ticket.status === 'USED') {
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: 'USED',
        operator,
        ip,
        userAgent
      }
    })
    return { ok: false, status: 'used' }
  }

  if (ticket.status === 'EXPIRED' || ticket.expiresAt < new Date()) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'EXPIRED' }
    })
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: 'EXPIRED',
        operator,
        ip,
        userAgent
      }
    })
    return { ok: false, status: 'expired' }
  }

  const updated = await prisma.ticket.updateMany({
    where: {
      id: ticket.id,
      status: 'VALID'
    },
    data: {
      status: 'USED',
      usedAt: new Date()
    }
  })

  if (updated.count === 0) {
    await prisma.scanLog.create({
      data: {
        ticketId: ticket.id,
        result: 'USED',
        operator,
        ip,
        userAgent
      }
    })
    return { ok: false, status: 'used' }
  }

  await prisma.scanLog.create({
    data: {
      ticketId: ticket.id,
      result: 'SUCCESS',
      operator,
      ip,
      userAgent
    }
  })

  return { ok: true, status: 'success' }
})
