import { defineEventHandler, getQuery } from "h3";
import { prisma } from "../../utils/prisma";
import { normalizeFingerprintHash } from "../../utils/fingerprint";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const raw = String(query.fingerprintHash || "").trim();
  if (!raw) {
    return { found: false };
  }

  const fingerprintHash = normalizeFingerprintHash(raw);
  const participants = await prisma.participant.findMany({
    where: { fingerprintHash },
    select: {
      id: true,
      name: true,
      school: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (participants.length === 0) {
    return { found: false };
  }

  return {
    found: true,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      school: p.school,
      createdAt: p.createdAt.toISOString(),
    })),
  };
});
