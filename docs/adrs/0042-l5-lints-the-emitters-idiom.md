# ADR-0042: L5 lints the emitter's idiom with oxlint on every target and each framework's own rules

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §5.7, §7.2 (L5), §7.3, §7.7, §9 M1, Appendix C; G2, G5, P2, P4, P7; R8; ADR-0020,
  ADR-0022, ADR-0025, ADR-0026, ADR-0028

## Context

L5 goes live in M1: "framework lint rules pass with zero warnings; conformance invariants are
AST-based, not substring checks" (§7.2). Three facts shape it:

- **TypeScript.** typescript-eslint, and every ESLint plugin built on it, peers TypeScript `<6.1`.
  The Vue, Svelte, Astro and Angular toolchains already run TypeScript 6 (ADR-0022); the React,
  Solid and Qwik toolchains run TypeScript 7, which has no JavaScript API.
- **oxlint** (already the repo's linter) implements React's rules natively, including the React
  Compiler rules of eslint-plugin-react-hooks, and runs ESLint plugins as JS plugins. It lints
  the script blocks of `.vue`, `.svelte` and `.astro` files, but never a template, and its JS
  plugins get no custom parser and no type information.
- **Most lint rules judge the author's code.** Every target copies the author's expressions, but
  oxlint sees them only in the JSX targets' output, and the a11y rule sets exist for some targets
  only. A probe over M1-shaped React output reported `no-shadow`, `no-useless-concat`,
  `no-constant-condition`, `jsx-a11y/prefer-tag-over-role` on `<svg role="img">` and more, all on
  the author's code, all on React, Solid and Qwik only. The compiler cannot fix any of them (P4).

## Decision

- **L5 judges the emitter's idiom, not the author's code.** A rule that can only fire on what the
  author wrote (an expression, a literal, text, markup) is off, or is an analyzer diagnostic that
  applies to every target. Every case must be lint-clean on every target; there is no per-case lint
  list.
- **The contract** is `Toolchain.lint(files, context): Promise<Map<string, ToolchainMessage[]>>`,
  with `typecheck`'s shape and ADR-0028's bar: an entry for every requested file and for any other
  path with messages; warnings are messages; a linter that cannot start, cannot load its
  configuration or a plugin, skips a requested file, or prints output the runner cannot read
  rejects. It is required on every target.
- **Two shared runners** in `@unframework/codegen/toolchain-node`: `lintWithOxlint`
  (`--disable-nested-config`, `--report-unused-disable-directives-severity=error`, JSON output,
  sorted messages) and `lintWithEslint` (`--no-inline-config`, run from the files' common ancestor,
  because ESLint 10 ignores files outside its base path).
- **One oxlint baseline on all seven targets**, identical except the `no-restricted-imports`
  allow-list, which a harness unit test compares with a per-target table: the `eslint`,
  `typescript`, `unicorn`, `oxc` and `import` plugins; the `correctness` and `suspicious` categories
  as errors; no type-aware rules; only the framework's imports allowed (P7); ESLint directives
  ignored.
- **The framework layer** runs where its parser can:

  | Target  | Framework layer                                                       | TypeScript |
  | ------- | --------------------------------------------------------------------- | ---------- |
  | React   | oxlint's native `react` rules; `react/no-unknown-property` named on   | 7          |
  | Solid   | `eslint-plugin-solid` as an oxlint JS plugin, with `prefer-show`      | 7          |
  | Qwik    | `eslint-plugin-qwik` (2.0 beta) as a JS plugin, minus its typed rules | 7          |
  | Vue     | ESLint 10, `eslint-plugin-vue` `recommended`, layout rules off        | 6          |
  | Svelte  | ESLint 10, `eslint-plugin-svelte` `recommended`                       | 6          |
  | Astro   | ESLint 10, `eslint-plugin-astro`                                      | 6          |
  | Angular | ESLint 10, angular-eslint for TS and inline templates                 | 6          |

  The Solid and Qwik toolchains allow `@typescript-eslint/utils` and its siblings to resolve
  TypeScript 7 (`peerDependencyRules`): under oxlint nothing calls TypeScript's API. Each
  toolchain's `.oxlintrc.json` and `eslint.config.js` holds the exact rule set (to verify in M1).

- **Rules off, each with its reason** (every toolchain's config carries the reason beside the rule):
  - a11y rules (`jsx-a11y`, angular-eslint's template a11y set): L11 runs axe on all seven targets;
  - rules on the author's expressions, literals and comparisons: `no-shadow` (UF3024 rejects the
    shadowing a rewrite would capture), `no-useless-concat`, `no-constant-condition`,
    `no-unneeded-ternary`, `no-underscore-dangle`, `use-isnan`, `valid-typeof`, the regex checks
    and oxc's comparison checks; Angular's `template/eqeqeq` (`==` is accepted, ADR-0035) and
    `vue/no-template-shadow`;
  - rules on the author's text and markup: `react/jsx-no-comment-textnodes` (the printer still
    writes `//` text as `{"…"}`), `react/iframe-missing-sandbox`, `qwik/jsx-img`, `qwik/jsx-a`;
  - `no-useless-escape`: targets write `</script` as `<\/script` (ADR-0041);
  - layout rules: the printer owns markup layout (ADR-0026); `vue/multi-word-component-names`:
    names are the author's; `react/react-in-jsx-scope`: the automatic runtime;
  - `svelte/valid-compile`: the compiler's warnings are L3's, as ADR-0028 did for L4;
  - Qwik's typed rules, `valid-lexical-scope` and `use-async-top`: a recorded gap (below).
- **Rules that stay on pin the emitters' idiom** (§6), for example `react/no-unknown-property`
  (React names), `solid/no-destructure`, `solid/prefer-for`, `solid/style-prop`,
  `qwik/no-react-props`, `vue/require-v-for-key`, `vue/attributes-order`,
  `vue/require-default-prop`, `svelte/require-each-key`, `svelte/no-useless-mustaches`, and
  angular-eslint's `prefer-control-flow`, `prefer-signals` and `component-selector` (an element,
  prefix `uf`, ADR-0010). Unused-variable rules stay on: targets omit unread props and index
  parameters.
- **In the harness**, L5 runs in each `toolchain:<target>` project beside L3 and L4, under
  `Promise.allSettled`, so a crashing linter fails L5 alone. Two canaries prove it (their names
  to verify in M1): `L5-debugger`
  puts `debugger;` in every output (the baseline), and `L5-framework-rule` writes one idiom
  violation per target (`class` on React, `className` on Solid and Qwik, `v-html` on Vue, …).
- **The open questions of ADR-0020 and ADR-0025:** the React Compiler's lint-only validations run
  in L5, through oxlint's native rules (to verify in M1: which of them the categories enable);
  eslint-plugin-astro does not check the markup Astro tolerates, so that stays with L11, L13 and
  the analyzer's nesting rules.

## Consequences

**Positive:**

- Each output is held to its framework's own lint rules, with zero warnings, on every case (G2).
- A lint failure always means the emitter wrote unidiomatic code, never that the author did.
- The TS 6 and TS 7 split from ADR-0022 stays intact: no toolchain gains a second TypeScript.

**Negative:**

- The author's own code is not linted by L5. An author who wants `no-shadow` runs a linter on the
  source.
- Qwik's lexical-scope rule, the one that checks QRL captures, does not run in M1. M1 outputs
  capture nothing but props in `component$`, so nothing depends on it yet.
- oxlint's JS plugins are alpha and "not subject to semver"; an oxlint bump can break Solid's or
  Qwik's L5, which is why the version is pinned (Appendix C).
- oxlint has no `--no-inline-config`. TODO(M1): record how an `oxlint-disable` comment copied
  from an author's expression is kept from silencing a rule.

**Open:**

- M2 needs Qwik's typed rules once outputs hold `$` closures: a TypeScript 6 lint host beside the
  Qwik toolchain, or typescript-eslint on TypeScript 7.1's API.
- A validator for the markup Astro tolerates.

## Alternatives considered

- **ESLint on every target.** typescript-eslint resolves its `typescript` peer from the toolchain,
  where React, Solid and Qwik need TypeScript 7 for tsgo (ADR-0022). They would need a second lint
  host with TypeScript 6, or typescript-eslint on TypeScript 7.1's API, which has not shipped.
- **oxlint alone.** It cannot parse a Vue, Svelte, Astro or Angular template, which is where those
  targets' idiom lives.
- **Keep the a11y and expression rules, with a per-case list of expected lint findings** (as
  `case.json` lists axe rules). Each finding would be the author's, on some targets only, which is
  a difference found by a test (P4). L11 already checks accessibility on all seven.
- **`eslint-plugin-react-hooks` as a JS plugin, as the plan's tool list says.** oxlint's native
  `react` rules implement the same rules; the plugin adds a second implementation to keep in step.

## Evidence

- A lab run of the proposed configurations over M0's 14 golden outputs reported nothing. One
  deliberately bad file per target was caught: `react-hooks(rules-of-hooks)` and `react(jsx-key)`
  on React, `solid/no-destructure` and `solid/prefer-for` on Solid, `qwik/jsx-key` on Qwik,
  `vue/require-v-for-key` and `vue/attributes-order` on Vue, `svelte/require-each-key` on Svelte,
  `astro/no-set-html-directive` on Astro, `template/prefer-control-flow` and `prefer-signals` on
  Angular, and `no-debugger` in `.tsx`, `.ts` and every script block.
- Qwik's typed rules crash under a JS plugin with "You have used a rule which requires type
  information"; with ESLint and typescript-eslint on TypeScript 6 they run.
- oxlint 1.86 puts `react/react-in-jsx-scope` in `suspicious` (15 hits in one React file) and
  `react/no-unknown-property` in `restriction`; 11 of the 65 `suspicious` rules are type-aware and
  silently do nothing without `--type-aware`.
- Lab timing for two files per target, warm, on macOS arm64: oxlint 0.03 s; oxlint with a JS plugin
  0.11 s (Solid) and 0.18 s (Qwik); ESLint 0.52–0.57 s per target, mostly process start.
  TODO(M1): L5's time per target over the M1 corpus in CI, and the two canaries' run times.
- TODO(M1): the number of rules each toolchain runs, from `oxlint --print-config` and ESLint's
  `--print-config`.
- Every M1 case is lint-clean on all seven targets, and both canaries fail L5 on every target
  (to verify in M1).
