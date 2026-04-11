export async function buildFingerprintHash(): Promise<string> {
  const source = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(navigator.hardwareConcurrency || ''),
    String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || '')
  ].join('|')

  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(source))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
