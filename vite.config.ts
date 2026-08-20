import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Agent worktrees live under .claude/ and carry their own copy of the
    // suite. Without this the runner counts them too, so a green run reports
    // hundreds of tests that are not this checkout's and would stay green even
    // if this one broke.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
  },
});
