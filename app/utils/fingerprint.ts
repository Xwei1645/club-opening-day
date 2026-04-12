import FingerprintJS from "@fingerprintjs/fingerprintjs";

const STORAGE_KEY = "participant_fingerprint";
const COOKIE_KEY = "participant_fingerprint";

let fpPromise: Promise<any> | null = null;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number = 365): void {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function syncFingerprint(fp: string): void {
  localStorage.setItem(STORAGE_KEY, fp);
  setCookie(COOKIE_KEY, fp);
}

export async function buildFingerprintHash(): Promise<string> {
  const localFp = localStorage.getItem(STORAGE_KEY);
  const cookieFp = getCookie(COOKIE_KEY);

  if (!localFp && !cookieFp) {
    if (!fpPromise) {
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    const visitorId = result.visitorId;
    syncFingerprint(visitorId);
    return visitorId;
  }

  if (localFp && !cookieFp) {
    setCookie(COOKIE_KEY, localFp);
    return localFp;
  }

  if (!localFp && cookieFp) {
    localStorage.setItem(STORAGE_KEY, cookieFp);
    return cookieFp;
  }

  if (localFp !== cookieFp) {
    setCookie(COOKIE_KEY, localFp);
    return localFp;
  }

  return localFp!;
}

export function updateFingerprint(newFp: string): void {
  syncFingerprint(newFp);
}
