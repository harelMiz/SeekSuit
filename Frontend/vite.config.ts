import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward all /api requests to the backend server
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // Strip the /api prefix before forwarding (e.g. /api/products → /products)
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
