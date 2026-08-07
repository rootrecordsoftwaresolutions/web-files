import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: "https://api-goals.rootrecord.info", changeOrigin: true },
      "/public": { target: "https://api-goals.rootrecord.info", changeOrigin: true },
    },
  },
});
