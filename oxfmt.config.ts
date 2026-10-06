import base from "@uxfront/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...base,
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    // Golden outputs and shared expectations are compared byte for byte. The compiler
    // formats its own output, and the harness writes the expectations.
    "tests/integration/cases/**/__output__/**",
    "tests/integration/cases/**/__expected__/**",
    // Diagnostic cases are deliberately wrong: some do not parse, and formatting would rewrite
    // the whitespace and the spellings they report.
    "tests/integration/cases/diagnostics/**",
    "packages/testing/test/parity/cases/**/__expected__/**",
    // Generated from the IR's types: `pnpm --filter @unframework/ir generate --check` compares
    // it byte for byte.
    "packages/ir/schema/**",
    // Vendored verbatim from @vue/runtime-dom: `pnpm --filter unframework vendor:jsx --check`
    // and the unframework tests compare it byte for byte.
    "packages/unframework/src/vendor/**",
  ],
});
