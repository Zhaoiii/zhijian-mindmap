import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "static"),
  base: "./",
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist-pages"),
    emptyOutDir: true,
  },
});
