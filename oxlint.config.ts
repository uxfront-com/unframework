import vue from "@uxfront/oxlint-config/vue";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vue],
  options: {
    typeAware: true,
  },
  ignorePatterns: [
    // Golden outputs are linted by each target's own toolchain (L5), not by the repo's rules.
    "tests/integration/cases/**/__output__/**",
    // Diagnostic cases are deliberately wrong.
    "tests/integration/cases/diagnostics/**",
    // Third-party types vendored verbatim (see packages/unframework/scripts/vendor-jsx.ts).
    "packages/unframework/src/vendor/**",
  ],
  overrides: [
    {
      // A component's event handler may be async: every target discards a handler's return value,
      // its promise included (ADR-0047). The rule's other checks stay on.
      files: ["**/*.uf.tsx", "packages/target-*/test/fixtures/**"],
      rules: {
        "typescript/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      },
    },
  ],
});
