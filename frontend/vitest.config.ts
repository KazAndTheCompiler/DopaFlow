/// <reference types="vitest" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/App.tsx",
        "src/surfaces/**",
        "src/shell/**",
        "src/components/**",
        "src/styles.css",
      ],
      thresholds: {
        statements: 30,
        branches: 60,
        functions: 40,
        lines: 30,
      },
    },
  },
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
});
