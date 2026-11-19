// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercelBuild = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

export default defineConfig({
  vite: {
    plugins: [mcpPlugin({ restRoutes: false, trustForwardedHost: false })],
    // The SDK's optional metrics fallback dynamically imports this Workers builtin.
    // Leave it external on Node/Vercel; its guarded fallback is never a Node dependency.
    ...(isVercelBuild ? { build: { rollupOptions: { external: ["cloudflare:workers"] } } } : {}),
  },
  // Lovable skips Nitro outside its own deployment context unless this is
  // explicit. Vercel needs Nitro output for TanStack Start SSR/server functions;
  // otherwise the build can succeed while deployed routes return Vercel 404s.
  nitro: isVercelBuild ? { preset: "vercel" } : true,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
