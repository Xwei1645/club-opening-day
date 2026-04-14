import { prisma } from "./prisma";

const CHARSET = "234679ACDEFGHJKMNPQRTUVWXYZ";
const CODE_LENGTH = 6;

function generateRandomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

export async function generateUniqueRecoverCode(
  maxAttempts: number = 100,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRandomCode();
    const existing = await prisma.participant.findUnique({
      where: { recoverCode: code },
    });
    if (!existing) {
      return code;
    }
  }
  throw new Error(
    "Failed to generate unique recover code after maximum attempts",
  );
}
