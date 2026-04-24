import { createError, defineEventHandler, getRequestHeader } from "h3";
import { prisma } from "../utils/prisma";

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/admin")) {
    return;
  }

  // 1. 检查超级管理员 Token
  const config = useRuntimeConfig();
  const adminToken = config.adminToken;
  if (!adminToken) {
    throw createError({
      statusCode: 500,
      statusMessage: "Admin token is not configured.",
    });
  }

  const authHeader = getRequestHeader(event, "authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const xAdminToken = getRequestHeader(event, "x-admin-token") || "";

  if (bearer === adminToken || xAdminToken === adminToken) {
    event.context.admin = { role: "SUPER_ADMIN" };
    return;
  }

  // 2. 检查普通检票员 Token
  const isVerifyPath = event.path.startsWith("/api/admin/verify");
  const xInspectorToken = getRequestHeader(event, "x-inspector-token") || "";

  if (xInspectorToken) {
    const inspector = await prisma.inspector.findUnique({
      where: { token: xInspectorToken, isActive: true },
    });

    if (inspector) {
      event.context.admin = {
        role: "INSPECTOR",
        id: inspector.id,
        name: inspector.name,
      };
      return;
    }
  }

  // 3. 都不匹配则报错
  throw createError({
    statusCode: 401,
    statusMessage: "Unauthorized access.",
  });
});
