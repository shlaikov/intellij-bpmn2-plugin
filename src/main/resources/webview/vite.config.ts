import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset URLs: the Kotlin host serves the app under a per-editor prefix (/editor/<id>/).
  base: "./",
  plugins: [react()],
});
