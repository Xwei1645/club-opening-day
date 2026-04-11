import { createHash } from 'node:crypto'

export function normalizeFingerprintHash(input: string): string {
  const value = input.trim().toLowerCase()
  const isSha256Hex = /^[a-f0-9]{64}$/.test(value)
  if (isSha256Hex) {
    return value
  }
  return createHash('sha256').update(value).digest('hex')
}
