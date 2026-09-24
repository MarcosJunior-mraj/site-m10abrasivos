import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // O marcador `server-only` (resolvido pelo próprio Next no build) só
    // existe para barrar import de componente de cliente; nos testes de
    // unidade, que rodam tudo no mesmo processo, ele vira módulo vazio.
    alias: { "server-only": "next/dist/compiled/server-only/empty.js" },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
  },
});
