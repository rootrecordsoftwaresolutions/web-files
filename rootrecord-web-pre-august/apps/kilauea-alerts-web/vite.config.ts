import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api/public/kilauea": {
        target: "https://api-kilauea.rootrecord.info",
        changeOrigin: true,
      },
    },
  },
});
