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
    {
      // A corpus spec uses the public API of @unframework.dev/testing and nothing else, as a
      // project's own specs do (ADR-0085): its root entry, never a subpath, no other
      // @unframework.dev package, and nothing of the harness's. `ignorePatterns` keeps this rule
      // off diagnostics/, which holds no spec. oxlint merges a rule's `group` patterns into one
      // list, so a negated group would let the subpaths through, and its regular expressions
      // have no lookahead: the subpath pattern is a regular expression, and only the package
      // pattern negates.
      // The sample design system's tests and examples are a project's own (ADR-0086, ADR-0087),
      // held to the same API.
      files: [
        "tests/integration/cases/**/*.{ts,tsx}",
        "tests/e2e/design-system/test/**/*.{ts,tsx}",
        "tests/e2e/design-system/examples/**/*.{ts,tsx}",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex: "^@unframework\\.dev/testing/",
                message:
                  "A spec imports the public API from the root of @unframework.dev/testing; its subpaths are the harness's (ADR-0085).",
              },
              {
                group: ["@unframework.dev/*", "!@unframework.dev/testing"],
                message:
                  "A spec imports @unframework.dev/testing and the case's own sources, no other @unframework.dev package (ADR-0085).",
              },
              {
                // A `harness`, `scripts` or `packages` segment anywhere in a relative path: the
                // harness's code, or a package's source reached around its entries.
                regex: "^\\.\\.?/(.*/)?(harness|scripts|packages)(/|$)",
                message:
                  "A spec never imports the harness's code or a package's source by path: use the public API of @unframework.dev/testing (ADR-0085).",
              },
            ],
          },
        ],
      },
    },
  ],
});
