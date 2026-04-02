import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "DopaFlow",
        short_name: "DopaFlow",
        start_url: "/",
        display: "standalone",
        background_color: "#f4efe4",
        theme_color: "#49615c",
      },
    }),
  ],
  resolve: {
    alias: {
      "@ds": path.resolve(__dirname, "src/design-system"),
      "@surfaces": path.resolve(__dirname, "src/surfaces"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@api": path.resolve(__dirname, "src/api"),
      "@shell": path.resolve(__dirname, "src/shell"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
  },
});

