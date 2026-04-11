import { defineEventHandler } from 'h3'
import { ensureDrawConfig } from '../../utils/draw'

export default defineEventHandler(async () => {
  return ensureDrawConfig()
})
