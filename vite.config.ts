import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { vitePluginImageProcessor } from "./transform-image-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/homepage/",
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
  },
  plugins: [
    tanstackRouter({
      routeFileIgnorePrefix: "-",
    }),
    react(),
    tailwindcss(),
    vitePluginImageProcessor({
      targetDir: "./src/assets/sites",
    }),
  ],
});
