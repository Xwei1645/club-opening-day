import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  return prisma.participant.findMany({
    include: { ticket: true },
    orderBy: { createdAt: 'desc' }
  })
})
