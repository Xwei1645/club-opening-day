import { defineEventHandler } from 'h3'
import { ensureDrawConfig } from '../../utils/draw'

export default defineEventHandler(async () => {
  const cfg = await ensureDrawConfig()
  return {
    drawAt: cfg.drawAt,
    drawStatus: cfg.drawStatus,
    publishStatus: cfg.publishStatus,
    resultGeneratedAt: cfg.resultGeneratedAt,
    ticketExpireAt: cfg.ticketExpireAt
  }
})
