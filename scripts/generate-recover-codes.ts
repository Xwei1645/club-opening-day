import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function generateUniqueCode(existingCodes: Set<string>): Promise<string> {
  let attempts = 0;
  while (attempts < 1000) {
    const code = generateRandomCode();
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique code");
}

async function main() {
  console.log("开始为现有参与者生成找回码...");

  const participants = await prisma.participant.findMany({
    where: { recoverCode: null },
    select: { id: true, name: true },
  });

  console.log(`找到 ${participants.length} 个需要生成找回码的参与者`);

  const existingCodes = new Set<string>();
  const existingParticipants = await prisma.participant.findMany({
    where: { recoverCode: { not: null } },
    select: { recoverCode: true },
  });
  existingParticipants.forEach((p) => {
    if (p.recoverCode) existingCodes.add(p.recoverCode);
  });

  let updated = 0;
  for (const participant of participants) {
    const code = await generateUniqueCode(existingCodes);
    await prisma.participant.update({
      where: { id: participant.id },
      data: { recoverCode: code },
    });
    updated++;
    if (updated % 50 === 0) {
      console.log(`已处理 ${updated}/${participants.length} 个参与者`);
    }
  }

  console.log(`完成！共为 ${updated} 个参与者生成了找回码`);
}

main()
  .catch((e) => {
    console.error("错误:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
