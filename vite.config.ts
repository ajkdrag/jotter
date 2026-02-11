import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  css: {
    transformer: "lightningcss",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  optimizeDeps: {
    include: [
      // Force these to be discovered upfront so Vite never
      // re-optimizes mid-session
      "@journeyapps/wa-sqlite",
      "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs",
      "@journeyapps/wa-sqlite/src/examples/OPFSAdaptiveVFS.js",
      "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js",
      "@journeyapps/wa-sqlite/src/examples/MemoryAsyncVFS.js",
    ],
  },
});
