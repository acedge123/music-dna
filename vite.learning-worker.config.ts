import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    ssr: resolve("scripts/learning-worker.ts"),
    target: "node22",
    outDir: "dist-learning-worker",
    emptyOutDir: true,
    rollupOptions: { output: { format: "es", entryFileNames: "worker.mjs" } },
  },
});
