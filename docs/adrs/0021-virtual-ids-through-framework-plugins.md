# ADR-0021: Virtual ids reach each framework's own Vite plugin

- **Status:** Accepted (M0 spike), amended by ADR-0027
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 4, M6); §11 D1; §5.5, §7.3, §8.2, R5, R6, R12, Appendix C

## Context

In browser and dev builds, `import Hello from "./Hello.uf.tsx"` must reach each framework's own
Vite plugin as native source. §8.2 has the unplugin run with `enforce: "pre"`, resolve each import
to a virtual id with the target's native extension, and let the framework's plugin "finish the
job"; §7.3 adds a guard that the browser runs the reviewed golden output. Vue and Svelte claim
modules by extension and issue style sub-requests, React, Solid and Qwik all claim `.tsx`, Qwik
splits a module into segments that point back at it, and Analog compiles Angular only from a
TypeScript program on disk. Spike 4 settles the ids and hooks (R12) in two runs with a fake plugin,
`ufFake({ target, onCompile })`, returning hand-written source: React, Vue, Svelte, Solid and an
Astro slot; then Angular, Qwik, React and Solid. Versions are Appendix C's (ADR-0018).

## Decision

1. **The id is the absolute path of the `.uf.tsx` plus the target's native extension:**

   | Target             | Component id                                 | Style id                                                 |
   | ------------------ | -------------------------------------------- | -------------------------------------------------------- |
   | React, Solid, Qwik | `/abs/Hello.uf.tsx` (unchanged)              | `/abs/Hello.uf.tsx.css`                                  |
   | Vue                | `/abs/Hello.uf.tsx.vue`                      | plugin-vue's own `…vue?vue&type=style&index=0&lang.css`  |
   | Svelte             | `/abs/Hello.uf.tsx.svelte`                   | plugin-svelte's own `…svelte?svelte&type=style&lang.css` |
   | Angular            | `/abs/Hello.uf.tsx.ts`, which is not on disk | in the component                                         |
   | Astro              | `/abs/Hello.uf.tsx.astro` (ADR-0020)         | Astro's own sub-requests                                 |

   Ids never take a `\0` prefix: plugin-vue's and plugin-svelte's filters exclude such ids, Qwik
   returns early for them in `resolveId`, `load` and `transform`, and Vite's oxc skips them, so raw
   JSX reaches import analysis. Angular's id ends in `.ts` because Analog's filter,
   `TS_EXT_REGEX = /\.[cm]?ts(?![a-z])/`, never matches `.tsx`. TSX styles use `.uf.tsx.css`, never
   a query on the `.tsx` path (`?uf&type=style&lang.css`): Vite filters on the path without its
   query, so Solid's babel and Vite's oxc parsed the CSS as TSX (`Unexpected token (1:0)`,
   `[PARSE_ERROR]`).

2. **The code comes from `load`, never from `transform`.** With a `transform`-only plugin, Vite's
   fallback load reads the virtual path from disk: Vue and Svelte failed with
   `Failed to load url /cases/hello/Hello.uf.tsx.vue (resolved id: …) Does the file exist?`, and
   React and Solid rendered only by reading the authored file. With `load`, every framework plugin
   uses the code passed to it (plugin-vue's `transform`, plugin-svelte's `compile` and its CSS
   module via `getModuleInfo(file).meta.svelte.css`, Solid's babel, Vite's oxc for React), and
   plugin order stops mattering. The unplugin stays first in `plugins` anyway.
3. **`resolveId` rules.** The hook has `filter: { id: /\.uf\.tsx/ }` and takes
   `(source, importer, opts)`.
   - **(a) Queries pass through.** Any `?` returns `null`, so framework sub-requests stay theirs.
     Astro keeps its query on the virtual id (ADR-0020).
   - **(b) A `*.uf.tsx` specifier** resolves through
     `this.resolve(source, importer, { skipSelf: true })` and gains the suffix, with two exceptions:
     - **(b1) The dependency scan.** Vite's scanner calls `resolveId` with `opts.scan` set but
       cannot run `load`, so a virtual id fails the whole scan. It uses only the returned `.id`,
       drops `external: true`, and externalises ids that are relative or contain `\0`. Two answers
       were verified, each on its own targets: `{ id: realPath, external: true }` (React, Vue,
       Svelte, Solid, Astro) and `\0uf-scan:<abs>` (Angular, Qwik, React, Solid).
     - **(b2) The watch edge.** If the importer is our own virtual module for the same source,
       return the real path. That is the edge `this.addWatchFile(source)` creates; without it,
       `vitest --watch` did not re-run Vue and Svelte. No `moduleGraph` registration is needed.
   - **(c) Virtual ids coming back,** as absolute paths or as root-relative URLs from a cold browser
     request (`/cases/hello/Hello.uf.tsx.vue`), map to the absolute id.
   - **(d) Absolute `.uf.tsx` paths resolve too.** Qwik's segments,
     `<parent>.uf.tsx_<Symbol>_<hash>.js`, match
     `/^(?<parent>.*\.[mc]?[jt]sx?)_(?<name>[^/]+)\.js/`, and Qwik re-resolves the parent with
     `this.resolve(parent, importer, { skipSelf: true })`. `load` must not claim the `.js` segments.
   - **(e) A relative `./Hello.uf.tsx.css`** from a compiled TSX module resolves next to it.
4. **Each toolchain declares `optimizeDeps.include`** for what compiled output imports, which the
   scanner never sees: React `react`, `react/jsx-dev-runtime`, `react-dom/client`; Vue `vue`
   (plugin-vue adds nothing); Svelte `svelte`, `svelte/internal/client`,
   `svelte/internal/disclose-version`; Solid `solid-js`, `solid-js/web`; Angular `@angular/core`,
   `@angular/common`, `@angular/platform-browser`; Qwik nothing, as it excludes its own packages.
5. **The guard.** `load` calls `onCompile({ id, source, target, code })`, and the harness compares
   `code` with `cases/<case>/__output__/<target>/<file>`. On a mismatch an `enforce: "post"` plugin
   replaces the module's final JS with `throw new Error(msg); export default undefined;`. Throwing
   from `load` gives an HTTP 500 that Vitest reports only as
   `Failed to fetch dynamically imported module`, and the `export default` keeps linking valid. So
   the unplugin returns `Plugin[]`: `[pre, post]`.
6. **Angular compiles virtual ids with ngtsc, through two plugins of ours** (on TypeScript 6,
   ADR-0022):

   ```ts
   plugins: [
     ngtscVirtual({ tsconfig, readVirtual }), // ngtsc AOT for *.uf.tsx.ts ids
     ...angular({ tsconfig, jit: false }), // Analog coexists but compiles nothing here
   ],
   optimizeDeps: {
     include: ["@angular/core", "@angular/common", "@angular/platform-browser"],
     rolldownOptions: { plugins: [angularLinker()] }, // links the pre-bundled framework
   },
   ```

   - **`ngtscVirtual`** (`enforce: "pre"`, about 90 lines) builds `@angular/compiler-cli`'s
     `NgtscProgram` over an in-memory `CompilerHost` in its `transform`, reusing `oldProgram` and a
     SourceFile cache. It reports `getTsSyntacticDiagnostics()`, `getNgStructuralDiagnostics()` and
     `getNgSemanticDiagnostics(id)` (strict templates) through `this.error`, and emits with
     `compiler.prepareEmit().transformers`. `host.resolveModuleNameLiterals` maps `./Child.uf.tsx`
     to the virtual `…/Child.uf.tsx.ts`, read through `readVirtual`, so uf-to-uf imports compile
     with the child's real metadata. The output is full AOT (`ɵɵdefineComponent`,
     `ɵɵdomElementStart`), so Analog sees no `@Component(` and passes it through.
   - **`angularLinker`** runs `JavaScriptTransformer` from `@angular/build/private` with
     `{ sourcemap: false, jit: false, maxConcurrency: 1 }` in the dep optimizer. Under Vitest,
     Analog's optimizer plugin registers no `load` hook, so the framework's `ɵɵngDeclare*` code
     would otherwise need `@angular/compiler` at runtime.

7. **Requirements found along the way.** Svelte output declares `<svelte:options runes={true} />`;
   without it the output imports `svelte/internal/flags/legacy` and calls
   `$.push($$props, false, …)`. Test toolchains use `solid({ hot: false })` and Qwik
   `devTools: { hmr: false }`; plugin-react 6 already skips Fast Refresh under Vitest.

**Plan §8.2 does not hold for Angular.** "Analog finishes the job" is false for virtual modules.
Analog compiles only files in its tsconfig program (rootNames plus `include` globs, on disk), built
at `buildStart`, and ignores `.tsx` and `/node_modules/` ids. Any other id gets the warning
`"…" contains Angular decorators but is not in the TypeScript program`, and its raw TC39
`@Component` then fails in the browser with `SyntaxError: Invalid or unexpected token`. Under
Vitest, Analog also defaults `jit` to true and skips linking the framework, and its
`disableTypeChecking` defaults to true.

So the unplugin's Angular path must ship `ngtscVirtual`, placed before Analog, in
`@unframework/target-angular/toolchain`, pinned with the Angular range, and the unplugin must expose
each compiled source to it (`readVirtual`). The tested fallback is writing the output to real files
inside the tsconfig `include`, outside `node_modules`, before Analog's `buildStart`. §8.2 and M6
need updating to say so.

## Consequences

**Positive:**

- One id rule serves every target. The framework plugins see real-looking files, so their own
  sub-requests work unchanged, and errors name `cases/hello/Hello.uf.tsx.svelte`.
- Angular runs real ngtsc AOT and linked framework code on virtual ids, with no runtime JIT, and
  template type errors fail the transform. Qwik's segments resolve from the virtual parent.

**Negative:**

- Display names come from the virtual filename: Vue warns `at <Warns.uf.tsx>` and names the
  component `__name: "Hello.uf.tsx"`, and Svelte names it `Hello_uf_tsx`. How the compiler sets
  names is open: Vue has a `name` option, Svelte has no per-file option.
- Rule (b1) relies on `scan`, which Vite 8 passes but the public `Plugin` type omits. The tested
  fallback, `optimizeDeps: { noDiscovery: true, include }`, is deterministic, but a missing CJS
  dependency (axe-core) gave `does not provide an export named 'default'` and a 60 s iframe timeout.
- plugin-vue's style sub-requests read a descriptor cache that the main module fills, and fall back
  to `fs.readFileSync` on a miss, which would be ENOENT for a virtual id. It was never observed.
- `ngtscVirtual` is our code on `NgtscProgram`, the API Analog uses, so Angular upgrades can break
  it.

**Open:**

- Whether to unify the two scan forms of rule (b1), or to rely on the untyped `scan` at all.
- One `NgtscProgram` per project, with every generated Angular file as `rootNames`, analysed once
  and emitted per id: when to build it, and how to invalidate it in watch mode.
- Whether `browser:angular` compiles the plugin's in-memory output or the committed golden file.
  `ngtscVirtual` supports both; the golden file needs a convention for its relative imports.

## Alternatives considered

- **Resolving to the committed golden file.** Simpler, since every plugin reads from disk, but it
  bypasses the compiler and the plugin pipeline users get, and the guard gives the same assurance.
  The SSR spike used it for Angular (ADR-0024).
- **Writing Angular output to disk for Analog** (`jit: false`). Real ngtsc, but the file must exist
  before `buildStart`, be in the tsconfig `include`, sit outside `node_modules` and have its imports
  relocated, and Analog re-reads its program only at `buildStart` in run mode. It is the fallback.
- **Analog `fastCompile: true, jit: false`.** It accepts virtual ids but is not ngtsc: it emits
  `changeDetection: 1` (Eager) where ngtsc omits the field, which Angular 22 reads as OnPush, and
  `ɵɵelementStart` where ngtsc emits `ɵɵdomElementStart`, and it skips template type-checking. Its
  README claims "~91% of Angular's conformance suite".
- **Analog JIT, or runtime linking of the framework.** It needs `@angular/compiler` loaded from a
  setup file listed first, and it is not the production code path.
- **Dropping Analog from the Angular project.** It passes, but users' Analog apps will run it, so
  coexistence is what must be proved. It stays an option if Analog ever interferes.

## Evidence

- **Transformed code:** React `jsxDEV` from `react/jsx-dev-runtime` with `className: "greeting"`;
  Solid ``_$template(`<p class=greeting>Hello, world!`)``; Vue `_sfc_main` with
  `_createElementBlock` and an import of its `?vue&type=style&index=0&lang.css`; Svelte
  `$.from_html(...)` and its `?svelte&type=style&lang.css`. All were in the `client` environment.
- **Tracing `browser:vue`:** `resolveId ./Hello.uf.tsx -> <root>/cases/hello/Hello.uf.tsx.vue`, then
  one `load`; sub-requests never reached the fake plugin. Without rule (c), `load` received the
  root-relative `/cases/hygiene/Warns.uf.tsx.vue`.
- **A cold cache before rule (b1):** `(!) Failed to run dependency scan … [UNLOADABLE_DEPENDENCY]`,
  `optimized dependencies changed. reloading`, `[vitest] Vite unexpectedly reloaded a test`, and 3
  failed test files. After it, repeated cold runs passed all 44 tests with no scan message and no
  reload. The Angular run failed the same way on `Hello.uf.tsx.ts` and passed with `\0uf-scan:`.
- **`UF_CANARY=text`:** every `hello.test.ts` failed with
  `Caused by: Error: [uf guard] vue output for cases/hello/Hello.uf.tsx differs from …` (per
  target). The throw-in-`load` variant showed only `Failed to fetch dynamically imported module`.
- **Order and watch:** the fake plugin after the framework plugins passed 15 tests, and
  `UF_ORDER=after` passed 7 in the Angular run. Before rule (b2), Vue and Svelte gave
  `NO re-run within 15s`; after it, every target printed `RERUN cases/hello/Hello.uf.tsx x1`.
- **The Angular matrix (`UF_ONLY=angular`):** the default passed. `UF_NGTSC=0` failed with the
  warning and the SyntaxError, `UF_NG_IDS=tsx` with the SyntaxError. `UF_NG_IDS=materialize`
  passed, but failed with "The component 'Hello' needs to be compiled using the JIT compiler" under
  `UF_NG_ANALOG='{}'` until `UF_LINK=0`. `fastCompile` passed, and so did `UF_NO_ANALOG=1`.
- **Linking:** without `angularLinker` the optimizer threw "The injectable 'PlatformLocation' needs
  to be compiled using the JIT compiler, but '@angular/compiler' is not available". With it,
  `@angular_platform-browser.js` and `common-*.js` held 0 `ɵɵngDeclare` calls (80 and 131 without).
- **ngtsc:** binding `[lable]` failed the transform at `Parent.uf.tsx.ts(8,33)` with "error
  TS-998002: Can't bind to 'lable' since it isn't a known property of 'uf-child'" and "TS-998008:
  Required input 'label' from component Child must be specified." Compiles took 406 ms (Hello,
  cold libs), 161 ms (Styled), 86 ms (Parent, pulling in Child) and 65 ms (Child).
- **Qwik:** the page requested `Counter.uf.tsx_Counter_uf_component_B2tcULGSvIQ.js` and
  `Counter.uf.tsx_Counter_uf_component_div_button_q_e_click_xsWpyrYcmiI.js`. With `\0` ids, import
  analysis failed: "Failed to parse source for import analysis".
