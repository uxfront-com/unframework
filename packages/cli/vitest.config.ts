import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The first command to run loads the compiler and every target.
    testTimeout: 60_000,
  },
});
