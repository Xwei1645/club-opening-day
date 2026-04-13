import FingerprintJS from "@fingerprintjs/fingerprintjs";

const STORAGE_KEY = "participant_fingerprint";
const COOKIE_KEY = "participant_fingerprint";
const RECOVER_CODE_STORAGE_KEY = "participant_recover_code";
const RECOVER_CODE_COOKIE_KEY = "participant_recover_code";

let fpPromise: Promise<any> | null = null;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match && match[2] ? decodeURIComponent(match[2]) : null;
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

  if (localFp && cookieFp && localFp !== cookieFp) {
    setCookie(COOKIE_KEY, localFp);
    return localFp;
  }

  return localFp || cookieFp || "";
}

export function updateFingerprint(newFp: string): void {
  syncFingerprint(newFp);
}

export function getLocalRecoverCode(): string | null {
  const localCode = localStorage.getItem(RECOVER_CODE_STORAGE_KEY);
  const cookieCode = getCookie(RECOVER_CODE_COOKIE_KEY);
  return localCode || cookieCode || null;
}

export function setLocalRecoverCode(code: string): void {
  localStorage.setItem(RECOVER_CODE_STORAGE_KEY, code);
  setCookie(RECOVER_CODE_COOKIE_KEY, code);
}

export function clearLocalRecoverCode(): void {
  localStorage.removeItem(RECOVER_CODE_STORAGE_KEY);
  document.cookie = `${RECOVER_CODE_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
