import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts on purpose: that one is async and wires the
// Tauri dev-server options and the Tailwind plugin, none of which a unit test needs.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  // `npm run build` installs ui-kit's own node_modules (with its own React); without this the
  // tests would load two Reacts and every ui-kit component would fail on `useState` of null.
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
  },
});
