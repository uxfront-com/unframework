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
    // The fixture projects' expectations, which `unframework test --update` writes.
    "packages/testing/test/fixtures/**/__expected__/**",
    // The sample design system's expectations, which `unframework test --update` writes.
    "tests/e2e/design-system/**/__expected__/**",
    // A visual run's generated specs and report (`unframework visual`, ADR-0087).
    "**/.unframework/**",
    // Generated from the IR's types: `pnpm --filter @unframework.dev/ir generate --check` compares
    // it byte for byte.
    "packages/ir/schema/**",
    // Vendored verbatim from @vue/runtime-dom: `pnpm --filter @uxfront/unframework vendor:jsx --check`
    // and the unframework tests compare it byte for byte.
    "packages/unframework/src/vendor/**",
    // Written by Styleframe's transpiler for the corpus's configuration: the harness compares it
    // byte for byte (tests/integration/harness/styleframe.unit.test.ts).
    "tests/integration/styleframe.d.ts",
    // Written by `pnpm test:budgets:update`, never by hand.
    "tests/integration/budgets.json",
  ],
});
