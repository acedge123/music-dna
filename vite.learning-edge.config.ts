import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  publicDir: false,
  build: {
    ssr: resolve("src/musicdna/learning/hosted-dispatch.ts"),
    target: "es2022",
    outDir: "supabase/functions/_shared",
    emptyOutDir: false,
    minify: false,
    rollupOptions: { output: { format: "es", entryFileNames: "musicdna-dispatch.bundle.mjs" } },
  },
});
