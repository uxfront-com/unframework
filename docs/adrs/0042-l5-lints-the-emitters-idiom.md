# ADR-0042: L5 lints the emitter's idiom with oxlint on every target and each framework's own rules

- **Status:** Accepted
- **Date:** 2026-10-05
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
  rejects. It is required on every target, and the harness passes it only the files a linter reads
  (no stylesheets).
- **Two shared runners** in `@unframework/codegen/toolchain-node` (`lint.ts`), each a process run
  from the toolchain directory, where the linters and their plugins are installed:
  - `lintWithOxlint`: `--config=<toolchain>/output.oxlintrc.json`, `--disable-nested-config`,
    `--format=json`, `--deny-warnings` and `--report-unused-disable-directives-severity=error`. It
    also rejects when a JS plugin fails on a file, when oxlint lints fewer files than it was given,
    and when its exit code disagrees with its report.
  - `lintWithEslint`: ESLint's API, driven in a child Node process, not its command line. The
    process's working directory stays the toolchain directory, where plugins look for what a
    project installs (eslint-plugin-astro resolves its TypeScript parser from there), while
    ESLint's own `cwd`, its base path, is the files' common real directory, because ESLint 10
    lints nothing outside it. Real paths, because macOS reaches its temporary directory through a
    symlink. It sets `noInlineConfig` and no cache, and a file ESLint reports as ignored rejects.
    The API also never reads the bulk-suppressions file the command line would take from its
    working directory.
- **The configuration file is `output.oxlintrc.json`**, not `.oxlintrc.json`: oxlint would take a
  `.oxlintrc.json` under `tests/toolchains/` for a nested configuration when the repository lints
  itself. The markup targets add an `eslint.config.js` beside it, and their `lint` runs both
  linters and merges the results by file (`mergeLintResults`): oxlint's baseline over the script
  blocks, frontmatter or TypeScript, ESLint's framework rules over the whole file.
- **One oxlint baseline on all seven targets**, identical but for the `no-restricted-imports`
  allow-list (only the framework's imports, P7).
  `tests/integration/harness/toolchain-lint.unit.test.ts` compares the configurations as oxlint
  reads them (`--print-config`, which expands the categories into rules) against a per-target table
  of allowed imports. The baseline: the `eslint`, `typescript`, `unicorn`, `oxc` and `import`
  plugins; the `correctness` and `suspicious` categories as errors, 125 rules; no `--type-aware`, so
  the 25 type-aware rules among them do not run; `respectEslintDisableDirectives: false`; and
  `typescript/no-extraneous-class` allowing a decorated class with no member (Angular).
- **The framework layer** runs where its parser can:

  | Target  | Framework layer                                                                                                                                 | Rules | TypeScript |
  | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- |
  | React   | oxlint's native `react` plugin by the categories, with `no-unknown-property` and `rules-of-hooks` named                                         | 41    | 7          |
  | Solid   | `eslint-plugin-solid` as an oxlint JS plugin: its `flat/typescript` rules as errors, and `prefer-show`                                          | 16    | 7          |
  | Qwik    | `eslint-plugin-qwik` (2.0 beta) as an oxlint JS plugin: its `strict` rules but the typed ones and `jsx-img`, `jsx-a`                            | 12    | 7          |
  | Vue     | ESLint 10, `eslint-plugin-vue` `flat/recommended-error`, `no-layout-rules`, and `block-lang`, `component-api-style`, `define-props-declaration` | 106   | 6          |
  | Svelte  | ESLint 10, `eslint-plugin-svelte` `flat/recommended`, and `block-lang`                                                                          | 35    | 6          |
  | Astro   | ESLint 10, `eslint-plugin-astro` `flat/recommended`, and the directive, script and class-list rules named                                       | 15    | 6          |
  | Angular | ESLint 10, angular-eslint's recommended rules for the class and the inline template, and the shape rules below                                  | 14+6  | 6          |

  The Solid and Qwik toolchains let `@typescript-eslint/utils` and its siblings resolve TypeScript
  7 (`peerDependencyRules` in `pnpm-workspace.yaml`): under oxlint nothing calls TypeScript's API.

- **Rules off, each with its reason beside it in the configuration:**
  - a11y rules (`jsx-a11y`, angular-eslint's template a11y set, Astro's `jsx-a11y`): L11 runs axe
    on all seven targets;
  - rules on the author's expressions, literals and comparisons: `no-shadow` (UF3024 rejects the
    shadowing a rewrite would capture), `no-constant-binary-expression`, `no-constant-condition`,
    `no-extra-boolean-cast` (`!!x && …` becomes a ternary's test), `no-unneeded-ternary`,
    `no-useless-concat`, `no-underscore-dangle`, `no-compare-neg-zero`, `no-loss-of-precision`,
    `no-unsafe-optional-chaining`, `use-isnan`, `valid-typeof`, the regular-expression checks,
    `no-irregular-whitespace` and `no-nonoctal-decimal-escape`, eleven of oxc's comparison and
    argument checks, four unicorn rules on spreads, length checks and `startsWith`; Angular's
    `template/eqeqeq` (`==` is accepted, ADR-0035), `vue/no-template-shadow`, and Astro's
    `prefer-object-class-list` and `prefer-split-class-list`;
  - rules on the author's text, markup and API: `react/jsx-no-comment-textnodes` (the printer still
    writes `//` text as `{"…"}`), `react/iframe-missing-sandbox`, `qwik/jsx-img`, `qwik/jsx-a`,
    `vue/multi-word-component-names` and `vue/prop-name-casing` (names are the author's),
    `svelte/no-unused-props` and `svelte/no-navigation-without-resolve` (SvelteKit's router);
  - `no-useless-escape`: a useless escape in an output is in code it copies, so it is the
    author's, `<\/script` included, which UF1002 asks for where a copied string would end a Vue or
    Svelte script block; only the Vue target escapes one itself, as a guard (ADR-0041);
  - `svelte/no-useless-mustaches`: the printer writes whitespace Svelte would trim as a
    string-literal mustache (`{" "}`), Svelte's own spelling for it (ADR-0026), and a static value
    Svelte's server would escape twice or fold as one too (ADR-0037, ADR-0038);
  - layout rules: the printer owns markup layout (ADR-0026); `react/react-in-jsx-scope`: the
    automatic runtime;
  - `svelte/valid-compile` and Astro's `valid-compile`: the compilers' warnings are L3's, as
    ADR-0028 did for L4;
  - `vue/comment-directive` and `svelte/comment-directive`: these rules implement
    `<!-- eslint-disable -->` comments in a template, which `noInlineConfig` does not reach, and an
    output must not silence its linter;
  - Qwik's typed rules, `valid-lexical-scope` and `use-async-top`: a recorded gap (below).
- **Rules that stay on pin the emitters' idiom** (§6), for example `react/no-unknown-property`
  (React's names; ignoring the attributes react-dom renders as written that the rule's list
  lacks, and `fill`), `react/rules-of-hooks`, `solid/no-destructure`, `solid/prefer-for`,
  `solid/prefer-show`, `solid/style-prop`, `solid/no-react-specific-props`,
  `solid/self-closing-comp`, `qwik/no-react-props`, `qwik/jsx-key`, `vue/require-v-for-key`,
  `vue/no-use-v-if-with-v-for`, `vue/attributes-order`, `vue/require-default-prop`,
  `vue/block-lang` (`ts`), `vue/component-api-style` (`script-setup`),
  `vue/define-props-declaration` (`type-based`), `svelte/require-each-key`, `svelte/block-lang`
  (`ts`), `astro/prefer-class-list-directive`, `astro/no-set-html-directive`, angular-eslint's
  `prefer-control-flow`, `prefer-signals`, `component-selector` (an element, prefix `uf`,
  ADR-0010), `template/no-empty-control-flow`, `template/no-interpolation-in-attributes` and
  `template/no-duplicate-attributes` (allowing a static `class` or `style` beside its binding).
  Unused-variable rules stay on, on every target: targets omit unread props and index
  parameters, bind an unread value they must declare under a `_` name, which the rules ignore
  (Vue's unread optional prop as `size: _size = 2`; on React, Solid and Svelte a props parameter
  nothing reads as `_props`, since an empty pattern is `no-empty-pattern`, or on React and Svelte
  an object-form one as `_` and its own name). oxlint does not run
  its `no-unused-vars` on a `.vue`, `.svelte` or `.astro` file, whose markup reads the script's
  bindings where oxlint cannot see them, so the Vue, Svelte and Astro configurations run
  typescript-eslint's `no-unused-vars` there, with oxlint's defaults (`varsIgnorePattern` and
  `argsIgnorePattern` `^_`); their parsers count the markup's reads. It also reports a value only
  a type reads, which oxlint's rule does not. astro-eslint-parser counts Astro's own read of
  `Props` only in a file that names `Astro`, so an Astro component that reads no prop exports its
  `Props` (ADR-0034).
- **No comment silences a linter.** ESLint runs with `noInlineConfig`. oxlint has no such flag:
  `respectEslintDisableDirectives: false` makes it ignore ESLint's directives, and the analyzer
  rejects (UF1002, with a safe fix that removes it) any `eslint`, `oxlint`, `global` or
  `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` comment in code an output copies: an
  expression, a props type, a default or a type declaration.
- **In the harness**, L5 runs in each `toolchain:<target>` project beside L3 and L4, under
  `Promise.allSettled`, so a crashing linter fails L5 alone. Two canaries prove it: `L5-debugger`
  writes `debugger;` where every component renders, which the baseline's `no-debugger` reports,
  and `L5-framework-rule` writes on every output's root element one idiom its framework's rules
  forbid: `class` on React, `className` on Solid and Qwik, `v-html` on Vue, a style directive for
  no property on Svelte, `*ngIf` on Angular and `set:html` on Astro.
- **The open questions of ADR-0020 and ADR-0025:** the React Compiler's lint-only validations run
  in L5, through oxlint's native port of them, as far as the two categories reach: in
  `correctness`, `error-boundaries`, `globals`, `immutability`, `incompatible-library`,
  `preserve-manual-memoization`, `purity`, `refs`, `set-state-in-effect`, `set-state-in-render`,
  `static-components`, `use-memo` and `void-use-memo`; in `suspicious`, `capitalized-calls`,
  `exhaustive-effect-dependencies`, `hooks` and `memo-dependencies`. Not on: `unsupported-syntax`
  (a restriction rule) and `no-deriving-state-in-effects` (a perf rule). eslint-plugin-astro does
  not check the markup Astro tolerates, so that stays with L11, L13 and the analyzer's nesting
  rules.

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
- An author loses lint and type-check directives in template expressions, props types and
  defaults, even where they would silence nothing in an output.
- Emitters carry constraints that exist for lint alone: `_` names for an unread props parameter
  or an unread optional Vue prop, unread props and index parameters left out, a middle empty
  branch never printed as an empty `@if {}` on Angular.

**Open:**

- M2 needs Qwik's typed rules once outputs hold `$` closures: a TypeScript 6 lint host beside the
  Qwik toolchain, or typescript-eslint on TypeScript 7.1's API.
- A validator for the markup Astro tolerates.
- Svelte's compiler warnings on accessibility, which L3 fails on (zero warnings), are not mirrored
  by the analyzer: `<button type="button" role="button">` and `<nav role="navigation">`
  (`a11y_no_redundant_roles`), `alt="image of a cat"` (`a11y_img_redundant_alt`) and `href="#"`
  (`a11y_invalid_attribute`) compile with no diagnostic and then fail Svelte's L3 alone. The a11y
  lint rules are off because L11 owns accessibility; M2 decides whether the analyzer reports what
  Svelte's compiler warns on, for every target, or the Svelte toolchain leaves a11y warnings to
  L11. (`<ul role="list">` draws no warning: Svelte 5.57 exempts it.)

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
- **ESLint's command line, as for the other checkers.** It takes its base path from its working
  directory, so either the plugins cannot find what the toolchain installs or the files fall
  outside the base path and are skipped.
- **Name the configuration `.oxlintrc.json`.** The repository's own `pnpm lint` would read it as a
  nested configuration for the toolchain directories.

## Evidence

- A lab run of the first configurations over M0's 14 golden outputs reported nothing. One
  deliberately bad file per target was caught: `react-hooks(rules-of-hooks)` and `react(jsx-key)`
  on React, `solid/no-destructure` and `solid/prefer-for` on Solid, `qwik/jsx-key` on Qwik,
  `vue/require-v-for-key` and `vue/attributes-order` on Vue, `svelte/require-each-key` on Svelte,
  `astro/no-set-html-directive` on Astro, `template/prefer-control-flow` and `prefer-signals` on
  Angular, and `no-debugger` in `.tsx`, `.ts` and every script block.
- Qwik's typed rules crash under a JS plugin with "You have used a rule which requires type
  information"; with ESLint and typescript-eslint on TypeScript 6 they run.
- oxlint 1.86 puts `react/react-in-jsx-scope` in `suspicious` (15 hits in one React file) and
  `react/no-unknown-property` in `restriction`, and `react/rules-of-hooks` in `pedantic`, so the
  configuration names the last two.
- Rule counts, from oxlint's and ESLint's `--print-config` in each toolchain directory, and
  `oxlint --rules` for the categories' React rules: the table above. Every toolchain turns 35
  baseline rules off.
- `tests/integration/harness/toolchain-lint.unit.test.ts`: "holds the same baseline on every
  target, but for the import allow-list", and every toolchain's `lint` catches a probe that breaks
  two baseline rules (`no-debugger`, and the unused-variable rule, typescript-eslint's on Vue,
  Svelte and Astro) and one of its framework's rules, in the target's own syntax. Each target's
  `test/lint.test.ts` lints its golden outputs and M1-shaped probes (`test/lint-probes.ts`); React's
  also sweeps the attribute vocabulary against `react/no-unknown-property`.
- `packages/analyzer/test/expressions.test.ts`, "lint and type-check directives": each directive
  comment is UF1002 in an expression, and its fix removes it.
- L5's time per target over the 31 golden outputs of each target in the M1 corpus, warm, as the
  harness calls `lint` (median of three on an Apple M4 Max, macOS arm64): React 35 ms, Qwik
  168 ms, Solid 169 ms, Astro 396 ms, Angular 436 ms, Vue 480 ms, Svelte 528 ms. ESLint's process
  start is most of the markup targets' time. Every file was clean.
- The M1 corpus is lint-clean at L5 on all seven targets, and both canaries fail L5 on all 31
  cases with output on every target, with `<output file>: no-debugger` and
  `<output file>: <framework rule>` as the evidence (`tests/integration/harness/canaries.ts`). Each
  canary's run of the seven `toolchain:` projects took about 3.5 s locally (`L5-debugger` 3.4 s,
  `L5-framework-rule` 3.5 s).
