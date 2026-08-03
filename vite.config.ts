import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { vitePluginImageProcessor } from "./transform-image-plugin";
import { vitePluginPrerenderRoutes } from "./prerender-routes-plugin";

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
    vitePluginPrerenderRoutes({
      // bounded /cv/{-$var} values — keep in sync with getCVContext in
      // src/data/cv-context.ts
      extraPaths: ["cv/default", "cv/su"],
      noindexPaths: ["cv", "cv/default", "cv/su"],
    }),
  ],
});
