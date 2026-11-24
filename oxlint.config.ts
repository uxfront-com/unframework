import vue from "@uxfront/oxlint-config/vue";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vue],
  // oxlint reads `env` and `ignorePatterns` from the root config only, so they're restated here.
  env: vue.env,
  options: {
    typeAware: true,
    // Migration baseline (UXF-1048): four directives name rules the baseline turns off. Restored
    // with the last rule.
    reportUnusedDisableDirectives: "off",
  },
  ignorePatterns: [
    ...vue.ignorePatterns,
    // Golden outputs are linted by each target's own toolchain (L5), not by the repo's rules.
    "tests/integration/cases/**/__output__/**",
    // Diagnostic cases are deliberately wrong.
    "tests/integration/cases/diagnostics/**",
    // Third-party types vendored verbatim (see packages/unframework/scripts/vendor-jsx.ts).
    "packages/unframework/src/vendor/**",
  ],
  rules: {
    // A catch names what it caught, like `cleanup` beside the render's `error`, or a `failure`
    // sent on as a reply's field. The rule's fix renames such shorthand properties too, which
    // changes the object it builds.
    "unicorn/catch-error-name": "off",
    // The rule reads every "utf-8" as an encoding name, but here they're HTML `charset` values,
    // which HTML spells "utf-8", in the rendered markup that tests expect.
    "unicorn/text-encoding-identifier-case": "off",
    // Hexadecimal numbers here are code points and hash constants, written as their standards
    // write them (`0xd800`, `0x811c9dc5`), so the rule groups only those already grouped, by four.
    "unicorn/numeric-separators-style": [
      "error",
      { hexadecimal: { onlyIfContainsSeparator: true, groupLength: 4 } },
    ],
    // Migration baseline (UXF-1048): the rules of @uxfront/oxlint-config 0.2.0 that this code
    // doesn't pass yet. Each later commit removes one entry and fixes its errors, or keeps it off
    // with its reason.
    "@nkzw/no-instanceof": "off",
    "array-callback-return": "off",
    eqeqeq: "off",
    "import/no-namespace": "off",
    "no-console": "off",
    "no-fallthrough": "off",
    "no-promise-executor-return": "off",
    "no-regex-spaces": "off",
    "no-useless-assignment": "off",
    "oxc/no-accumulating-spread": "off",
    "prefer-promise-reject-errors": "off",
    "quality/no-array-filter-map": "off",
    "quality/no-chained-type-assertions": "off",
    "quality/no-conditional-empty-object-spread": "off",
    "quality/no-known-value-widening": "off",
    "quality/no-object-parameters": "off",
    "quality/no-reflect-apply": "off",
    "quality/no-reflect-get": "off",
    "quality/no-unknown-returns": "off",
    "quality/no-unsafe-dictionary-type": "off",
    "typescript/no-empty-object-type": "off",
    "typescript/no-explicit-any": "off",
    "typescript/no-implied-eval": "off",
    "typescript/no-non-null-assertion": "off",
    "typescript/no-unsafe-argument": "off",
    "typescript/no-unsafe-assignment": "off",
    "typescript/no-unsafe-call": "off",
    "typescript/no-unsafe-function-type": "off",
    "typescript/no-unsafe-member-access": "off",
    "typescript/no-unsafe-return": "off",
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/switch-exhaustiveness-check": "off",
    "typescript/use-unknown-in-catch-callback-variable": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/no-array-fill-with-reference-type": "off",
    "unicorn/no-magic-array-flat-depth": "off",
    "unicorn/prefer-array-flat-map": "off",
    "unicorn/prefer-native-coercion-functions": "off",
    "unicorn/prefer-structured-clone": "off",
    "unicorn/prefer-top-level-await": "off",
  },
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
      // An element applies a directive by its name in kebab case, `v-focus-trap` for `vFocusTrap`
      // (ADR-0099), which no JSX rule reads as a use of the name.
      files: ["**/*.uf.tsx"],
      rules: {
        "no-unused-vars": [
          "error",
          { varsIgnorePattern: "^(?:_|v[A-Z][A-Za-z0-9]*$)", argsIgnorePattern: "^_" },
        ],
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
                regex: String.raw`^@unframework\.dev/testing/`,
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
                regex: String.raw`^\.\.?/(.*/)?(harness|scripts|packages)(/|$)`,
                message:
                  "A spec never imports the harness's code or a package's source by path: use the public API of @unframework.dev/testing (ADR-0085).",
              },
            ],
          },
        ],
      },
    },
    {
      // A component's source keeps the form its author wrote, since every output follows it: the
      // corpus's golden outputs on seven targets, and the docs pages that quote them verbatim. A
      // target's fixtures are the outputs its tests compare byte for byte. So a style rule
      // doesn't rewrite either.
      files: ["**/*.uf.{ts,tsx}", "packages/*/test/fixtures/**", "packages/*/probes/fixtures/**"],
      rules: {
        // The compiler must keep lowering the braceless `if` that authors write.
        curly: "off",
        // Prop types reach every output as written, and `T[]` is the form most authors use.
        "typescript/array-type": "off",
        // Numbers in a component reach its outputs as written.
        "unicorn/numeric-separators-style": "off",
        // Strings in a component reach its outputs as written.
        "unicorn/prefer-string-raw": "off",
        // Calls in a component reach its outputs as written.
        "unicorn/prefer-string-replace-all": "off",
        // Imports in a component reach its outputs as written, and a target's fixtures keep the
        // inline `type` specifiers its output uses.
        "import/consistent-type-specifier-style": "off",
        // An assertion that the source's types don't need can be one an output's framework types
        // need, like an event's target, and it reaches every output as written.
        "typescript/no-unnecessary-type-assertion": "off",
      },
    },
  ],
});
