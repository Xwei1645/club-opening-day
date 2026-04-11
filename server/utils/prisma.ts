import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || !raw.startsWith("file:")) {
    return raw;
  }

  const filePart = raw.slice(5);
  const cwdPath = resolve(process.cwd(), filePart);
  if (existsSync(cwdPath)) {
    return raw;
  }

  const parentPath = resolve(process.cwd(), "..", filePart);
  if (existsSync(parentPath)) {
    return `file:${parentPath.replace(/\\/g, "/")}`;
  }

  return raw;
}

const dbUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
