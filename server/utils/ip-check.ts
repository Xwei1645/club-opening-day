interface IpApiResponse {
  status: string;
  city?: string;
  regionName?: string;
  country?: string;
}

export async function checkIpLocation(ip: string): Promise<{ allowed: boolean; city?: string; region?: string }> {
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { allowed: true, city: "本地", region: "本地" };
  }

  try {
    const response = await $fetch<IpApiResponse>(`http://ip-api.com/json/${ip}?lang=zh-CN`, {
      timeout: 5000,
    });

    if (response.status !== "success") {
      return { allowed: true };
    }

    const city = response.city || "";
    const region = response.regionName || "";

    const isWenzhou =
      city.includes("温州") ||
      region.includes("温州") ||
      city.toLowerCase() === "wenzhou" ||
      region.toLowerCase() === "wenzhou" ||
      city.includes("瑞安") ||
      city.includes("乐清") ||
      city.includes("永嘉") ||
      city.includes("平阳") ||
      city.includes("苍南") ||
      city.includes("文成") ||
      city.includes("泰顺") ||
      city.includes("洞头");

    return {
      allowed: isWenzhou,
      city,
      region,
    };
  } catch (error) {
    console.error("IP location check failed:", error);
    return { allowed: true };
  }
}
