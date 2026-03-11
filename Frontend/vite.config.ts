import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward all /api requests to the backend server
      // No rewrite — the backend also uses the /api prefix (e.g. /api/products → localhost:5000/api/products)
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
