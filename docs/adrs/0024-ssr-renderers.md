# ADR-0024: SSR renderers for L6 in `ssr:<target>` projects

- **Status:** Accepted (M0 spike), amended by ADR-0027 and ADR-0031
- **Date:** 2026-10-01
- **Plan:** §9 (M0, an extra spike); §7.2 (L6, L12), §7.3, §7.5, §8.5, R5, R6, R7, Appendix C

## Context

L6 renders every case's SSR scenarios on each target and compares the normalised server HTML with
the shared `__expected__/ssr.<scenario>.html` (§7.2, §7.3). It is live from M0, but none of the six
numbered spikes covered it, so an extra spike de-risked it for React 19.3, Vue 3.5.43, Svelte
5.57.1, Solid 1.9.15, Angular 22.2.1 and Qwik 2.0.0-beta.47. Astro's L6 is ADR-0020. It asked:

- Can one `vitest run` hold six node projects whose Vite plugins are the frameworks' own, in SSR
  mode, given that React, Solid and Qwik all claim `.tsx`?
- Can a component reach each plugin through a fake compiler plugin's id (`ufFake({ target })`)?
- Which server API renders one component, with props, to a string, and what exactly does it emit?
  That is the input for §7.5.
- Is the output deterministic and free of console noise?

The spike's scratch project used Node 24.21.0, pnpm 11.2.2, vitest 5.0.3, vite 8.3.1, the five Vite
plugins at Appendix C's versions, `@angular/build` 22.2.0 and typescript 6.0.3.

## Decision

1. **Projects.** One root `vitest.config.ts` holds six inline projects, each with
   `name: "ssr:<target>"`, `environment: "node"`, `pool: "forks"`,
   `include: ["harness/ssr.test.ts"]`, `provide: { ufTarget: target }` and plugins
   `[unframework({ target }), ...toolchain.vitePlugins()]`. The root has no plugins, because inline
   projects inherit it (ADR-0018 adds `extends: false`). Each project gets its own Vite server, so
   the `.tsx` transforms never meet. `pool: "forks"` is explicit because Analog switches its project
   to `vmThreads` otherwise.
2. **Ids.** React, Solid and Qwik keep `/abs/X.uf.tsx`, Vue gets `/abs/X.uf.tsx.vue` and Svelte
   `/abs/X.uf.tsx.svelte` (ADR-0021). Angular resolved to the committed golden file,
   `/abs/__output__/angular/x.ts`, listed in Analog's tsconfig `include`, because Analog's ngtsc
   path compiles only files in its TypeScript program. That makes ADR-0021's guard (plugin output
   equals golden) a precondition of Angular's L6. ADR-0021's `ngtscVirtual` compiles virtual ids
   instead; it was not tried in SSR mode.
3. **Toolchain options**, the same for SSR and the browser:
   - React: `react()`.
   - Vue: `vue({ template: { transformAssetUrls: false } })`. Otherwise plugin-vue turns
     `src="/a.png"` into an import, which renders as `/@fs/a.png`.
   - Svelte: `svelte({ configFile: false })`, which silences "no Svelte config found".
   - Solid: `solid({ ssr: true })`, keeping the hydratable default so L12 can reuse the compile.
     Without `ssr: true` the plugin emits DOM code and `renderToStringAsync` returns `undefined`
     with no error. It generates SSR code only `if (options.ssr && isSsr)`, where `isSsr` is
     `this.environment.config.consumer === "server"`.
   - Angular: `angular({ jit: false, tsconfig: "<abs>/tsconfig.angular.json" })`, an absolute path
     because Analog reads `tsconfig.spec.json` by default. Analog defaults to JIT under Vitest.
   - Qwik:
     `qwikVite({ srcDir: "<abs>/cases", devTools: { hmr: false, clickToSource: false, imageDevTools: false } })`.
     `srcDir` must exist, and `hmr` adds `q-d:q-hmr` attributes and `_qwikEv` scripts.
4. **Renderers.** Each target has `harness/render/<target>.ts`, exporting
   `render(Component, props): Promise<{ html, raw }>` and `renderToString(Component, props)`. `html`
   is only the component's own HTML; `raw` is everything the framework emitted. Deciding what is the
   component belongs to the renderer, so the normaliser never sees documents, containers or state
   scripts.
   - **React:** `prerender` from `react-dom/static` on `<html><head/><body>{C}</body></html>`, read
     with `await new Response(prelude).text()`, taking the content of `<body>`. Rendered as a
     fragment, React 19 prepends `<link rel="preload" as="image" href="/a.png"/>` for each `<img>`.
   - **Vue:** `createSSRApp(C, props)`, then `renderToString(app)` from `vue/server-renderer`.
   - **Svelte:** `await render(C, { props })` from `svelte/server`, taking `body`.
   - **Solid:** `renderToStringAsync(() => createComponent(C, props))` from `solid-js/web`, throwing
     if the result is not a string.
   - **Angular:** `import "@angular/compiler"` first, because Vitest externalises the partially
     compiled Angular packages and no linker runs. Then, inside
     `renderApplication(async (ctx) => …)`: `createApplication({ providers: [] }, ctx)`,
     `createComponent(C, { environmentInjector })`, `ref.setInput(k, v)` per prop,
     `appRef.attachView(ref.hostView)` and
     `appRef.injector.get(DOCUMENT).body.appendChild(ref.location.nativeElement)`. The options are
     `{ document: "<html><head></head><body></body></html>", url: "http://localhost/", allowedHosts: ["localhost"] }`,
     and the HTML is the content of `<body>`. Inputs are set before the first change detection.
   - **Qwik:**
     `renderToString(jsx(C, props), { containerTagName: "uf-qwik-container", qwikLoader: "never", preloader: false })`
     from `@qwik.dev/core/server`, taking the container's inner HTML and removing container scripts
     (`type="qwik/*"`, `q:func`, `id="qwikloader"`, `_qwikEv.push`). No manifest is needed under
     Vitest; QRLs render as `mock-chunk#…`.
5. **The harness.** `harness/ssr.test.ts` runs once per project. It reads the target with
   `inject("ufTarget")`, finds components with `import.meta.glob("../cases/**/*.uf.tsx")`, reads
   scenarios from each case and expectations with `import.meta.glob(…, { query: "?raw" })`. It
   renders each scenario twice with `console.*` spied and asserts: no `console.warn` or `error`; the
   two renders are byte-equal once Qwik's per-render ids are masked; the normalised HTML equals the
   expectation; and more than zero cases were collected.
6. **Normalisation input (§7.5).** These rules remove the noise observed. The real normaliser parses
   HTML (parse5, say), rather than using the spike's tokenizer.

   | Target  | Noise in the raw output                                                                                   | Rule                                                                |
   | ------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
   | React   | `<!-- -->` between adjacent text nodes, `<br/>`, `disabled=""`                                            | Drop comments; canonical void and boolean forms.                    |
   | Vue     | none for one root; `<!--[-->`/`<!--]-->` around fragments                                                 | Drop comments.                                                      |
   | Svelte  | `<!--[-->…<!--]-->` around the body; newlines between elements become a single-space text node            | Drop comments; whitespace by HTML rendering rules.                  |
   | Solid   | `data-hk="00"`; `<!--$-->`/`<!--/-->` around dynamic text                                                 | Drop `data-hk` and comments.                                        |
   | Angular | the `<uf-x style="display: contents;">` host; no `_nghost`/`_ngcontent` without styles                    | Unwrap `uf-*` hosts; drop `ng-version`, `ng-server-context`, `ngh`. |
   | Qwik    | a bare `:` attribute on every element (`:="ii_0"`, `:=""`), `q:p`, `q:key`, `q-e:click`, `q-d:*`, `q-w:*` | Drop `:`, `q:*` and `q-[edw]:*`.                                    |

   §7.5's `on:*` is Qwik 1 syntax, and a `/^q:/` rule misses `:` and `q-e:`.

## Consequences

**Positive:**

- L6 runs as six cheap node projects: 24 tests in about 0.5–0.65 s of Vitest time, 1.3–2.1 s wall.
- Every framework renders the component through its own compiler in Vite's `ssr` environment
  (consumer `server`): Vue `ssrRender`, Svelte `svelte/internal/server`, Solid `ssr` templates,
  Angular Ivy AOT shaped like `ngc`'s output, Qwik segments with `_noopQrlDEV`, React `jsxDEV`.
- Renderers are the contract for `@unframework/testing` (§8.5): one per target toolchain.

**Negative:**

- Two real cross-target differences surfaced in the second case, and both need policy: Vue rewrites
  static asset URLs, and React hoists resource hints.
- Svelte's single-space text nodes mean the normaliser cannot delete whitespace between tags
  everywhere; that would hide a real inline-spacing difference. The spike's blanket `>\s+<` did.
- Qwik's `q:instance` comes from `randomStr()` (`Math.random`) and is written after
  `containerAttributes`, so it cannot be fixed. Mask it, `qFuncs_<id>` and the `_qwikEv` instance.
- Even `--project ssr:x` loads the whole config and every toolchain's plugin modules, about 1 s.

**Open:**

- Angular outside the harness: the golden-on-disk trick only works in tests. ADR-0021 answers it
  for the browser with `ngtscVirtual`. Whether `ssr:angular` uses it too, and drops this exception,
  is open; it was not tried.
- Solid: `ssr: true` with hydration (ready for L12, normalising `data-hk`) or `hydratable: false`
  for cleaner L6 output. The spike recommends hydration.
- Vue: should the emitter bind static URLs (`:src="'…'"`), or should Unframework document Vue's
  asset-URL rewriting? The harness disables it.
- Whitespace: block versus inline rules in the normaliser, or a Svelte emitter that never adds
  whitespace between siblings.
- Production-mode SSR (React, Svelte and Qwik production builds, Qwik `q:render="ssr"` with a real
  manifest) is not covered under Vitest's dev server. Decide whether L12 or M6's e2e apps cover it.

## Alternatives considered

- **Analog `fastCompile: true` on a virtual `.uf.tsx.ts` id.** The only Analog path that compiles
  virtual modules, but it emits `changeDetection: 1` (Eager), `ɵɵelementStart` and
  `dependencies: () => [X]`, where ngtsc 22.2.1 omits the field (OnPush) and emits
  `ɵɵdomElementStart`. That would hide OnPush bugs at L8 and L9.
- **Analog JIT,** its default under Vitest. It renders, but from downlevelled decorators at
  runtime, which is not the AOT code users ship.
- **A virtual id on Analog's default path.** "contains Angular decorators but is not in the
  TypeScript program", then `SyntaxError: Invalid or unexpected token` in Node.
- **Angular `bootstrapApplication`.** It cannot set root inputs before the first change detection,
  and adds `ng-version` and `ng-server-context="other"`, plus `ngh="0"` and `<!--nghm-->` with
  `provideClientHydration()`. It stays the future L12 path.
- **React `renderToString`, or `prerender` on a fragment.** Both prepend the preload links.
- **Qwik's default document container.** The root JSX must then be `<head>` and `<body>`; a JSX
  `<html>` throws `Code(Q12)`. A fragment container is simpler.
- **One Vite config with every framework plugin.** React, Solid and Qwik all claim `.tsx`.

## Evidence

- **Install:** `pnpm peers check` reported only `@qwik.dev/core@2.0.0-beta.47` wanting
  `vitest >=2 <5`.
- **First runs:** `Qwik srcDir "…/src" not found`; then React, Vue, Svelte and Solid passed while
  Angular failed with
  `The injectable 'PlatformLocation' needs to be compiled using the JIT compiler, but '@angular/compiler' is not available.`
  and Qwik's `q:instance` differed between two renders. Importing the compiler led to
  `NG05706: Host http://localhost/ is not allowed`, which `allowedHosts` fixed. A `UF_PROBE=1` run
  showed `angular pool=vmThreads isolate=false`, then `pool=forks isolate=true` after setting
  `pool`.
- **Final run:** `Test Files 6 passed (6)`, `Tests 24 passed (24)`. Cold, 509 ms Vitest and 1.58 s
  wall; warm, 551–657 ms and 1.66–2.10 s; one project, 123–406 ms (Qwik slowest) and 0.97–1.39 s;
  under a load average of 9.5, 0.8–1.4 s and 2.7–3.4 s.
- **Raw output for `basics/hello`:**

  ```text
  react   <!DOCTYPE html><html><head></head><body><p class="greeting">Hello, <!-- -->world<!-- -->!</p></body></html>
  vue     <p class="greeting">Hello, world!</p>
  svelte  {"head":"","body":"<!--[--><p class=\"greeting\">Hello, world!</p><!--]-->"}
  solid   <p data-hk="00" class="greeting">Hello, <!--$-->world<!--/-->!</p>
  angular <html><head></head><body><uf-hello style="display: contents;"><p class="greeting">Hello, world!</p></uf-hello></body></html>
  qwik    <uf-qwik-container q:container="paused" q:runtime="2" q:version="2.0.0-beta.47-dev+919c91b" q:render="ssr-dev" q:base="/build/" q:locale="" q:manifest-hash="dev" q:instance="7httwf" :=""><p :="ii_0" class="greeting">Hello, world!</p></uf-qwik-container>
  ```

  All six normalise to `<p class="greeting">Hello, world!</p>`.

- **`basics/nested-and-void`:** all six normalise to
  `<section class="card"><h2>Title</h2><p>Line one<br>Line two</p><img alt="A" src="/a.png"><input disabled type="text"></section>`
  once React renders inside the document shell and Vue has `transformAssetUrls: false`. Svelte's raw
  body is `<section class="card"><h2>Title</h2> <p>…</p> <img …/> <input …/></section>`.
- **Console:** every report shows `console: []`. The canary, Vue with `{ name: 42 }`, captured
  `[Vue warn]: Invalid prop: type check failed for prop "name". Expected String with value "42", got Number with value 42.`
- **Solid:** without `ssr: true`, `template(...)` and `insert(...)`, then the guard's
  "Solid SSR produced no string". `hydratable: false` gave the clean `<p>`.
- **Angular:** `pnpm exec ngc` on the same source emitted `ɵɵdomElementStart` and no
  `changeDetection`, matching the default-path module; `fastCompile` passed L6 with
  `changeDetection: 1`; JIT passed with `__esDecorate` code.
- **Qwik with a handler:** `q-e:click="mock-chunk#_run#1"`, and even with `qwikLoader: "never"` the
  container held `qwik/state`, `qwik/vnode` and
  `<script>(window._qwikEv||(window._qwikEv=[])).push("e:click",0,"k0b09v")</script>`.
- **Types:** `tsc -p tsconfig.json` (TypeScript 6.0.3) over the harness, renderers, plugin and
  config reported no errors.
