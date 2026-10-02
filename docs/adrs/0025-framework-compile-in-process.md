# ADR-0025: L3 runs each framework's own compiler in-process

- **Status:** Accepted (M0 spike), amended by ADR-0028
- **Date:** 2026-10-01
- **Plan:** §9 (M0, an extra spike); §7.2 (L3, L4, L11, L13), §7.3, §7.7, §7.9, R6, R8, Appendix C

## Context

L3 says every golden output is accepted by its framework's own compiler with zero warnings (§7.2).
It is live from M0 and runs in a Vitest node project per target, `toolchain:<target>` (§7.3), but
none of the six numbered spikes covered it. An extra spike looked for one programmatic contract
that runs the real compiler on one output file and returns errors and warnings:

`frameworkCompile(filename, source): Promise<{ errors: Message[]; warnings: Message[] }>`, with
`Message = { message, line?, column?, code? }` (line 1-based, column 0-based).

For each target it asked which API is the compiler, whether it has a warnings channel, whether it
silently tolerates corrupt markup (the canaries of §7.7 depend on that), and how long a file takes.
The spike's scratch project used Node 24.21.0 on darwin/arm64 and Appendix C's versions.

## Decision

1. **One checker module per target behind the shared contract,** loaded lazily with
   `loadFrameworkCompile(target)`, so each project imports only its own compiler. One spec runs in
   seven projects named `toolchain:<target>`, reading its target with `inject("target")`. The gate
   is `expect(await frameworkCompile(file, src)).toEqual({ errors: [], warnings: [] })`.
2. **The compilers, and where errors and warnings come from:**
   - **Vue:** `@vue/compiler-sfc` 3.5.43: `parse`,
     `compileScript(descriptor, { id, inlineTemplate: false })`, `compileTemplate` with `ssr` false
     and true, and `compileStyle` for inline styles. Errors come from `parse().errors`,
     `compileScript` throwing, `compileTemplate().errors` and `compileStyle().errors`.
     `compileTemplate` turns template warnings into location-less `tips`, so the checker passes
     `compiler: { parse, compile: (src, o) => CompilerDOM.compile(src, { ...o, onWarn }) }` (with
     `@vue/compiler-dom` and `-ssr` at the same version) and adds
     `descriptor.template.loc.start.line - 1`. Script warnings reach only `console.warn`, through
     `warnOnce`, so they are captured from the console.
   - **Svelte:** `compile(source, { filename, generate, runes: true })` from `svelte/compiler`, for
     `"client"` and then `"server"`. Errors are a thrown `CompileError` (the first only); warnings
     are `result.warnings`. `runes: true` makes legacy syntax in the output an error.
   - **Solid:** `@babel/core` 7.29.7 `transformSync` with `babel-preset-solid` (`generate: "dom"`,
     then `"ssr"` with `hydratable: true`) and `@babel/preset-typescript`
     (`isTSX`, `allExtensions`, `onlyRemoveTypeImports`). Errors are thrown with a `reasonCode`. The
     only warning is dom-expressions' malformed-HTML `console.warn`, four calls with no location or
     code, joined and labelled `SOLID_MALFORMED_HTML`; it comes only from the DOM pass, which runs
     first.
   - **React:** `@babel/core` 7.29.7 with `babel-plugin-react-compiler` 1.0 first, as
     `{ target: "19", panicThreshold: "none", compilationMode: "infer", logger }`. `PipelineError`
     and thrown errors are errors. `CompileError` (bailouts, coded `react-compiler/<category>`),
     `CompileDiagnostic` and `CompileSkip` are warnings. A file with no `CompileSuccess` gets
     `react-compiler/nothing-compiled`, so the check cannot pass vacuously.
   - **Qwik:** `createOptimizer()` from `@qwik.dev/optimizer` 2.1.0-beta.9, the Rust binding core
     depends on, with
     `transformModules({ input: [{ path, code }], srcDir, entryStrategy: { type: "segment" }, transpileTs: true, transpileJsx: true, explicitExtensions: true, mode: "dev", isServer })`
     for `isServer` false and true. `@qwik.dev/core/optimizer` declares `createOptimizer` in its
     types but does not export it at runtime, and `@qwik.dev/optimizer`'s own `.d.ts` points at
     missing files, so the types come from core. Category `"error"` and `"sourceError"` are errors,
     `"warning"` a warning. `highlights[].startCol` is 1-based, and parse errors have `code: null`.
   - **Angular:** `NgtscProgram` from `@angular/compiler-cli` 22.2.1 on TypeScript 6.0 (ADR-0022),
     with the strict `ng new` options plus `strictTemplates`, `strictStandalone`,
     `typeCheckHostBindings`, `extendedDiagnostics: { defaultCategory: "warning" }` and `noEmit`.
     Category `Error` diagnostics (TS syntactic and semantic, NG structural and semantic) are
     errors; `Warning`, `Suggestion` and `Message` (the extended diagnostics) are warnings. Codes
     `-99xxxx` map to `NGxxxx`. `paths: { "@angular/*": [<the toolchain's @angular>/*] }` lets
     golden trees with no Angular dependency resolve it; without it, TS2307 and NG1010.
   - **Astro:** `transform()` from `@astrojs/compiler-rs` 0.5.1, which astro 7.3.5's own `compile()`
     calls, with Astro's options (ADR-0020). `severity: "error"` and `styleError` are errors; any
     other severity is a warning. Diagnostics have no code; `labels[0].line` is 1-based, `column`
     0-based, and start and end are byte offsets.
3. **Angular runs one program per target, not one per file.**
   `angularCompileMany(Map<file, source>)` builds one `NgtscProgram` over every Angular tree in
   `beforeAll` and groups diagnostics by file, so the spec still asserts per case. If any file has a
   TS syntax error, ngtsc skips every semantic check for the whole program and the other files look
   clean, so it re-checks the parsable files on their own. The other six run per file.
4. **For Angular, L3 and L4 are the same run.** ngtsc with strict templates is the type checker.
   The other six do not type-check; types stay in L4.
5. **The L3 canary is a mismatched closing tag** (`</p>` → `</span>`), the only corruption every
   compiler reports as an error. E is an error, W a warning, and `-` means nothing was reported:

   | Target  | Mismatched | Dropped inner | Dropped root | Stray close | Div in p | Img no alt | Unterminated quote |
   | ------- | ---------- | ------------- | ------------ | ----------- | -------- | ---------- | ------------------ |
   | vue     | E          | E             | E            | E           | W        | -          | E                  |
   | svelte  | E          | W             | E            | E           | E        | W          | E                  |
   | solid   | E          | E             | E            | E           | W        | -          | E                  |
   | react   | E          | E             | E            | E           | -        | -          | E                  |
   | qwik    | E          | E             | E            | E           | -        | -          | E                  |
   | angular | E          | -             | -            | E           | E        | -          | E                  |
   | astro   | E          | E             | E            | E           | -        | -          | E                  |

   The stray `</p>` here is nested in an element. Astro accepts one at the top level and drops it,
   so neither a dropped closing tag nor a top-level stray close may be the canary.

6. **Toolchains fail loudly when they cannot be trusted.** The Vue checker refuses to load under
   `NODE_ENV=production`, where compiler-dom loads its production build and every warning vanishes.
   Astro and Qwik assert that the compiler they import is the exact version the framework depends
   on. Angular rejects TypeScript outside `>=6.0 <6.1` itself (`MIN_TS_VERSION` and
   `MAX_TS_VERSION`, read in the bundle, not run).
7. **Babel 7, not Babel 8, for the React Compiler.** `babel-preset-solid` also peers
   `@babel/core ^7`.

## Consequences

**Positive:**

- L3 for all seven targets costs well under a second per target for M0's corpus, and about 1–2 s
  for Angular at 250 cases. That fits the CI budget (§7.9).
- Every valid fixture (a static attribute, `<br />`, an `<img>` with a data URL and `alt`) gives no
  errors and no warnings on every target, and every deliberate syntax error is an error.
- Svelte, Qwik and Angular return structured warnings, and React's bailouts arrive through the
  logger, so "zero warnings" means something there.

**Negative:**

- Vue's script warnings and Solid's HTML validation are read from the console. The capture swaps
  `console.warn` process-wide, so it must wrap synchronous calls only, never an `await`.
- Vue's `warnOnce` keeps a module-level `hasWarned` set, so a script warning is reported once per
  process and a later file with the same warning comes back clean. Template warnings are not
  deduped (read in the code).
- Some corruptions pass L3. Angular accepts unclosed elements at end of file and a `<p>` closed
  implicitly by its parent. Astro accepts `<p><div>`, duplicate attributes, `<br>text</br>`,
  `<img></img>` and a top-level stray `</p>`. React, Qwik and Astro say nothing about `<p><div>`,
  and only Svelte flags a missing `alt`. L11 (axe) and L13 (console hygiene) must cover these;
  React's runtime nesting warning reaching L13 was not verified.
- Astro emits no warnings at all yet, so its zero-warnings check is vacuous (ADR-0020).
- The Qwik optimizer bindings ship darwin-arm64, linux-x64-gnu and win32-x64 plus a wasm fallback,
  with no linux-arm64 binding.

**Open:**

- Should Angular's L3 also run `program.emit()` to catch emit-phase errors? The spike used `noEmit`.
- Vue `<style src>` and Angular `styleUrl` are not compiled by L3. Should one lightningcss check per
  case cover shared CSS?
- Should React's L3 turn on the React Compiler's lint-only validations, or leave them to L5?
- Canaries that repeat a Vue script warning: isolated workers, or reloading `@vue/compiler-sfc`
  (about 35 ms) per canary?
- Does `@vitejs/plugin-react` 6.1.1, with `@rolldown/plugin-babel`, pick Babel 8 in the browser
  projects? If so, the React Compiler would bail out there too. The browser spikes did not enable
  the compiler.
- Should L5 or an HTML validator cover the markup Astro tolerates?

## Alternatives considered

- **Each framework's Vite plugin through `vite build`.** Not run. It means a full build per target;
  Vue's and Solid's warnings would only be logged, and Astro's `compile()` throws on the first error
  diagnostic and drops the rest.
- **The `ngc` CLI.** Not run. It drives the same `NgtscProgram` but prints text, which we would
  parse back into per-file results. `performCompilation` (read, not run) stops at the first failing
  phase and emits unless `noEmit` is set.
- **One Angular program per file.** Correct, but about 57 ms per file warm against about 0.8–1.6 ms
  in a batch. It stays as `frameworkCompile` for ad-hoc use.
- **Qwik's TypeScript optimizer** (`tsOptimizer: true` or `QWIK_OPTIMIZER=ts`). It silently repairs
  `<p>…</span>` into `<p>…</p>`, because it reports parse errors only when the parsed body is empty.
  Importing `@qwik.dev/optimizer` directly also bypasses the `QWIK_OPTIMIZER` switch.
- **`@astrojs/compiler` (Go/WASM 2.x).** Astro 7.3.5 no longer uses it.
- **Babel 8 (8.0.6).** React Compiler 1.0 falsely bails out on `({ name = "world" })` with
  "(BuildHIR::lowerAssignment) Expected object property value to be an LVal, got:
  AssignmentPattern", and preset-typescript rejects `isTSX` and `allExtensions`.
- **`svelte/compiler` with `generate: false`.** Not measured. Both real passes take 0.7 ms per warm
  file and also catch codegen-time errors.

## Evidence

- **`pnpm exec vitest run`:** 8 test files and 142 tests passed (angular 36, astro 20, qwik 16,
  react 18, solid 16, svelte 19, vue 17) in 1.5–3.3 s, up to 7 s under a load average of 8.
  `tsc6 -p .` was clean. The only unmet peer was Qwik's `vitest >=2 <5`.
- **Fixture codes:**
  - Vue: `VUE_23` (Invalid end tag, 2:35) and `VUE_24` for a mismatched tag;
    `BABEL_PARSER_SYNTAX_ERROR` (2:13) for script syntax; the warnings
    `<div> cannot be child of <p>…` (2:22) and `` `defineProps` is a compiler macro… ``.
  - Svelte: `element_invalid_closing_tag`, `element_unclosed`, `element_implicitly_closed` (a
    warning) for `<div><p>…</div>`, `element_invalid_closing_tag_autoclosed` for
    `<p><div></div></p>`, `a11y_missing_attribute` and `css_unused_selector`.
  - Solid: `MissingClosingTagElement` and `UnterminatedJsxContent`.
  - React: `react-compiler/Immutability`, `Hooks`, `Refs` (×3), `RenderSetState`, `skip` for
    `"use no memo"`, and `nothing-compiled` for a lowercase function.
  - Qwik: `Expected corresponding JSX closing tag for <p>` (no code), `C02` for a captured function
    and `preventdefault-passive-check`.
  - Angular: `NG5002`, `NG8001`, `TS2339` in a template, `TS1109`, and the warnings `NG8111`,
    `NG8109` and `NG8117`.
  - Astro: `Closing tag '</span>' has no matching opening tag.` and `Unexpected token`.
- **Astro warning hunt:** 17 suspicious inputs, including `set:html` with children, `client:load` on
  an element and an unclosed comment, all gave `[]`, except `<p class={>`, an error.
- **Qwik TS optimizer:** `Mismatched.tsx []`, emitting `_jsxSorted("p", …, "Hello, world!")`.
- **Vue:** the dedupe probe gave `first 1`, then `second 0`; under `NODE_ENV=production`, before the
  guard, both warnings disappeared.
- **Timings,** idle machine, in ms (about twice as high under a load average of 8):

  | Target  | Import | First file | Warm mean per file | p95  |
  | ------- | ------ | ---------- | ------------------ | ---- |
  | vue     | 35     | 11.9       | 0.40               | 0.81 |
  | svelte  | 77     | 13.3       | 0.70               | 1.13 |
  | solid   | 57     | 23.4       | 1.36               | 2.56 |
  | react   | 43     | 18.6       | 2.58               | 4.10 |
  | qwik    | 1–3    | 1.9–5.8    | 0.28               | 0.34 |
  | angular | 117    | 257        | 57 (per file)      | 67   |
  | astro   | 5      | 0.4        | 0.02               | 0.03 |

  Angular in one warm program: 10 files 72 ms, 50 files 92 ms, 250 files 189 ms. Cold: 1 file
  294 ms, 250 files 622 ms and 1000 files 967 ms, each after a 142–171 ms import.
