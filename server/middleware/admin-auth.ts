import { createError, defineEventHandler, getRequestHeader } from "h3";
import { prisma } from "../utils/prisma";

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/admin")) {
    return;
  }

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

  throw createError({
    statusCode: 401,
    statusMessage: "Unauthorized access.",
  });
});
