export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: process.env.NODE_ENV === "development" },
  sourcemap: {
    server: false,
    client: false,
  },
  css: ["vant/lib/index.css"],
  runtimeConfig: {
    adminToken: process.env.NUXT_ADMIN_TOKEN || "dev-admin-token",
    public: {
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL || "http://localhost:3000",
    },
  },
  nitro: {
    routeRules: {
      "/**": {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-XSS-Protection": "1; mode=block",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        },
      },
    },
  },
  vite: {
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ["console.log", "console.info", "console.debug"],
        },
        mangle: {
          toplevel: true,
          safari10: true,
        },
        format: {
          comments: false,
        },
      },
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          chunkFileNames: "_nuxt/[hash].js",
          entryFileNames: "_nuxt/[hash].js",
          assetFileNames: "_nuxt/[hash].[ext]",
        },
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  },
});
