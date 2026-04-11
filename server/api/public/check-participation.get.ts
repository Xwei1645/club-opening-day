import { defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const raw = String(query.fingerprintHash || "").trim();
  if (!raw) {
    return { participated: false };
  }

  const participant = await prisma.participant.findUnique({
    where: { fingerprintHash: normalizeFingerprintHash(raw) },
    select: { id: true },
  });

  return { participated: !!participant };
});
