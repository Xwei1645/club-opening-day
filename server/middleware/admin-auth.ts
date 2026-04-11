import { createError, defineEventHandler, getRequestHeader } from "h3";

export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/admin")) {
    return;
  }

  const config = useRuntimeConfig();
  const token = config.adminToken;
  if (!token) {
    throw createError({
      statusCode: 500,
      statusMessage: "Admin token is not configured.",
    });
  }

  const authHeader = getRequestHeader(event, "authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const fallback = getRequestHeader(event, "x-admin-token") || "";

  if (bearer !== token && fallback !== token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized admin request.",
    });
  }
});
