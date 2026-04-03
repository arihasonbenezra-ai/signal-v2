import { resolve } from "node:path"
import dotenv from "dotenv"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

// Load .env files into process.env before reading the Anthropic key.
// Vite's loadEnv() alone can miss ANTHROPIC_API_KEY depending on prefix rules.
const root = process.cwd()
dotenv.config({ path: resolve(root, ".env") })
dotenv.config({ path: resolve(root, ".env.local"), override: true })
dotenv.config({ path: resolve(root, ".env.development"), override: true })
dotenv.config({ path: resolve(root, ".env.development.local"), override: true })

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, root, ["VITE_", "ANTHROPIC_"])
  const anthropicKey =
    loaded.ANTHROPIC_API_KEY ||
    loaded.VITE_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY ||
    ""

  if (!anthropicKey && mode === "development") {
    console.warn(
      "\n[vite] ANTHROPIC_API_KEY is missing. Add to .env in the project root (same folder as package.json):\n" +
        "  ANTHROPIC_API_KEY=sk-ant-api03-...\n" +
        "Then restart the dev server.\n",
    )
  }

  const setAnthropicHeaders = (proxyReq) => {
    if (!anthropicKey) return
    proxyReq.setHeader("x-api-key", anthropicKey)
    proxyReq.setHeader("anthropic-version", "2023-06-01")
    // Required when the proxied request looks like a browser/CORS call (Origin from localhost).
    proxyReq.setHeader("anthropic-dangerous-direct-browser-access", "true")
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Dev only: browser → /api/chat → Anthropic /v1/messages (key added here; never in the client bundle).
        "/api/chat": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/chat/, "/v1/messages"),
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq) => {
              setAnthropicHeaders(proxyReq)
            })
          },
        },
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq) => {
              setAnthropicHeaders(proxyReq)
            })
          },
        },
      },
    },
  }
})
