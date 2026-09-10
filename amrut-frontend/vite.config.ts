import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom")
          )
            return "react";
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/react-router-dom")
          )
            return "react-router";
          if (id.includes("node_modules/@tanstack/react-query"))
            return "react-query";
          if (id.includes("node_modules/clsx")) return "clsx";
          if (id.includes("node_modules/tailwind-merge"))
            return "tailwind-merge";
        },
      },
    },
  },
});
