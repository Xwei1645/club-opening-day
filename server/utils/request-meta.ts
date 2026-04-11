import { getRequestHeader, getRequestIP, H3Event } from "h3";

export function requestMeta(event: H3Event) {
  return {
    ip: getRequestIP(event, { xForwardedFor: true }) || "0.0.0.0",
    userAgent: getRequestHeader(event, "user-agent") || "unknown",
  };
}
