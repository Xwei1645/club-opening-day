export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },
  css: ["vant/lib/index.css"],
  runtimeConfig: {
    adminToken: process.env.NUXT_ADMIN_TOKEN || "dev-admin-token",
    public: {
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL || "http://localhost:3000",
    },
  },
});
