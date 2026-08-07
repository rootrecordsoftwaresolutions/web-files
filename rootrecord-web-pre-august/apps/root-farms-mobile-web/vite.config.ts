import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../root-farms-web/src"),
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
});
