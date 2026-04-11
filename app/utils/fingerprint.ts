import FingerprintJS from "@fingerprintjs/fingerprintjs";

let fpPromise: Promise<any> | null = null;

export async function buildFingerprintHash(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }

  const fp = await fpPromise;
  const result = await fp.get();

  return result.visitorId;
}
