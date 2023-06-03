import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        wifiManager: resolve(__dirname, "wifi-manager.html"),
      },
    },
  },
});
