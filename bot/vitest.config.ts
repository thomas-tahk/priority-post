import { defineConfig } from "vitest/config";

// The bot was previously picking up the web app's root vitest.config.ts by
// directory walk, which only globs src/**. Declare our own so eval/ is covered.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "eval/**/*.test.ts"],
  },
});
