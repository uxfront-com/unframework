# ADR-0018: One Vitest 5 run with one browser project per target

- **Status:** Accepted (M0 spike)
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 1); §7.2 (L7–L11, L13), §7.3, §7.5, §7.9, §8.5, R5, R6, R9, Appendix C

## Context

§7.3 runs the same `*.test.ts` files once per target, in `browser:<target>` projects. In each
project `./X.uf.tsx` resolves through the unplugin with `{ target }` and then through that
framework's own Vite plugin. React, Solid and Qwik all claim `.tsx`, and Analog turns Vite's oxc
off for its project, so the framework transforms must never share a pipeline. Spike 1 asks whether
one `vitest run` can host all of these projects.

Two runs answer it, each with a fake compiler plugin, `ufFake({ target })`, that returns
hand-written framework source from `load`:

- React, Vue, Svelte and Solid, plus an Astro slot that mounts static HTML. Astro proper is
  ADR-0020.
- Angular (Analog), Qwik, React and Solid together. How their ids compile is ADR-0021.

Every Appendix C version worked as listed: vitest and @vitest/browser-playwright 5.0.3, playwright
1.63.0 (Chromium 153.0.8010.12, `chromium-1243`, already cached), vite 8.3.1 (rolldown 1.2.12),
@vitejs/plugin-react 6.1.1, @vitejs/plugin-vue 6.0.9, @sveltejs/vite-plugin-svelte 7.3.1,
vite-plugin-solid 2.11.14, @analogjs/vite-plugin-angular 2.7.5, @angular/\* 22.2.1, @qwik.dev/core
2.0.0-beta.47, axe-core 4.13.0, Node 24.21 and pnpm 11.25.0.

## Decision

1. **One root `vitest.config.ts` with `test.projects`.** Every browser project comes from one
   factory, `browserProject(target)`. The root declares projects and reporters, never plugins.
2. **Every project sets `extends: false`.** With the default `extends: true`, a root marker plugin,
   `uf-root-marker`, appeared in every project's plugins. Shared test options live in the factory.
   (The Angular and Qwik run used `extends: true` under a plugin-free root, which also worked.)
3. **The project shape:**

   ```ts
   {
     extends: false,
     plugins: [...unframework({ target }), ...toolchain.vitePlugins()],
     optimizeDeps: { include: toolchain.optimizeDeps },
     test: {
       name: `browser:${target}`,
       include: ["cases/**/*.test.ts"],
       setupFiles: ["<common setup>", toolchain.setupFile],
       provide: { target },
       browser: {
         enabled: true,
         provider: playwright(),
         headless: true,
         instances: [{ browser: "chromium", name: `browser:${target}` }],
         commands,
       },
     },
   }
   ```

   Name the instance. Without `name` the project is called `browser:<target> (chromium)`, which
   broke a name comparison in a command. The spec reads its target with `inject("target")`, typed
   by augmenting `ProvidedContext` in `declare module "vitest"`.

4. **Isolation comes from Vitest.** A project with Vite-level options (`plugins`, `browser`,
   `optimizeDeps`) gets its own Vite server and its own headless Chromium; `sharedViteServer`
   only shares the root server with projects that have none. Each server's plugin list holds only
   its own framework.
5. **Shared specs are `.ts`, never `.tsx`.** vite-plugin-solid transforms every `.tsx` and `.jsx`
   id, and React's oxc JSX would too, so JSX in a shared spec would compile differently per project.
6. **The toolchain** (later `@unframework/target-<name>/toolchain`) supplies the framework's Vite
   plugins, the runtime entries for `optimizeDeps.include` (ADR-0021) and a setup file that calls
   `registerMount(target, fn)`. The adapters and plugin options that worked:
   - React: `react()`. `createRoot` and `await act(...)`, with
     `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in the setup file; without it, a strict run caught
     two `The current testing environment is not configured to support act(...)` errors.
   - Vue: `vue()`. `createApp().mount()` and `nextTick()`.
   - Svelte: `svelte()`. `mount()` and `flushSync()`.
   - Solid: `[solid({ hot: false })]`. `solid()` returns one plugin, not an array, and `hot: false`
     keeps solid-refresh out of the code under test. `render(() => createComponent(C, {}), el)`.
   - Angular: Analog plus our plugins (ADR-0021). Zoneless, with no zone.js installed:
     `createApplication({ providers: [provideZonelessChangeDetection()] })`, then
     `createComponent(C, { environmentInjector: appRef.injector })`,
     `container.append(ref.location.nativeElement)` and `appRef.attachView(ref.hostView)`. Settle
     with `await appRef.whenStable()` and unmount with `appRef.destroy()`.
   - Qwik:
     `qwikVite({ csr: true, srcDir: <tests root>, devTools: { clickToSource: false, hmr: false } })`.
     The setup file imports `@qwik.dev/core/qwikloader.js`. Mount with
     `await render(container, jsx(C, props))` in a fresh container each time, and clean up with
     `result.cleanup()`. After an update, settle with `_waitUntilRendered(_getDomContainer(el))`
     from `@qwik.dev/core/internal`, and still use a retrying `expect.element`, because event QRLs
     load lazily.
   - Astro: no Vite plugin in the browser; ADR-0020 mounts server HTML.
7. **`mount()` is framework-agnostic.** It creates a container tagged `data-testid="uf-root-N"` and
   returns `{ container, locator: page.getByTestId(...), html() }`. The locator serialises to
   `internal:testid=[data-testid="uf-root-N"s]`, which stays stable when the DOM changes.
8. **ARIA snapshots come from a server-side browser command.** The browser calls
   `commands.ariaSnapshot(view.locator)`. The locator arrives in Node as `{ selector, locator }`,
   and the command runs `ctx.iframe.locator(selector).ariaSnapshot()`;
   `(await ctx.frame()).locator(…)` also works. `import type {} from "@vitest/browser-playwright"`
   types `ctx.page`, `frame` and `iframe`, and commands are declared in
   `declare module "vitest/browser"`. Vitest 5's in-browser
   `utils.aria.renderAriaTree(utils.aria.generateAriaTree(el))` and the experimental
   `toMatchAriaInlineSnapshot()` gave the same text, so they are a command-free fallback.
9. **Console hygiene (L13) lives in a common setup file.** `beforeAll` wraps `console.error` and
   `console.warn`, applying printf-style `%s` formatting, because React logs format strings.
   `beforeEach` resets the capture. `afterEach` runs `cleanup()` and then throws on any message not
   allowlisted with `allowConsole(pattern, reason)`. Throwing from `afterEach` fails the test.
10. **Projects run in parallel.** `sequence.groupOrder` is reserved for ordering the reference
    first (ADR-0019). CI selects a target with `--project browser:<target>`.

The raw DOM each target produced inside the mount container is the normaliser's input (§7.5):

- React, Vue, Svelte, Solid and the Astro slot: `<p class="greeting">Hello, world!</p>`, identical
  and with no comment anchors.
- Angular: `<uf-hello style="display: contents;"><p class="greeting">Hello, world!</p></uf-hello>`.
  With styles, the host has `_nghost-ng-c<hash>=""` and each element `_ngcontent-ng-c<hash>=""`.
  `@if` leaves `<!--container-->`. `createComponent` adds no `ng-version`, while
  `bootstrapApplication` adds `ng-version="22.2.1"` and logs "Angular is running in development
  mode."
- Qwik: `<p class="greeting">Hello, world!</p>`. The container gets `q:container="resumed"`. Client
  rendering adds no `q:*` attribute or comment to the subtree, even for the `<span>` a conditional
  inserts after a click. With `devTools.hmr` on, the root element gets `q-d:q-hmr=""`.

## Consequences

**Positive:**

- One `vitest run` produces one report for every target. `--project browser:vue` and globs such as
  `--project 'browser:s*'` select subsets, which suits a CI ×7 matrix.
- Analog's `oxc: false` and its TypeScript stripping of every `.ts` id stay inside its own project.
  The transformed-code dumps show that each project ran only its own compiler.
- axe-core runs in every project (`axe.run(container)`, no violations), so L11 reuses this setup.
- No project printed `console.error` or `console.warn` during mount.

**Negative:**

- Each project costs one Chromium process and one Vite server, so seven targets mean seven browsers
  per run. Sharding and the per-target CI matrix bound that.
- Each project has its own optimizer cache, `node_modules/.vite/vitest/<hash>/deps`. A cold cache is
  safe only with ADR-0021's dependency-scan handling. Without it a clean checkout reloads mid-run.
- Even a single-project run loads the whole config. For Angular most of the time is fixed startup:
  loading Analog and `@angular/compiler-cli`, plus the browser.
- qwikVite's config hook sets process-wide globals (`globalThis.qDev`, `qTest`, `qInspector`), and
  vite-plugin-solid sets `test.environment = "jsdom"`. Both were harmless here.
- Qwik's settle hook uses internal APIs. `@qwik.dev/core` 2.0.0-beta.47 peers `vitest >=2 <5`, which
  is only a pnpm warning, and `@qwik.dev/core/testing` cannot load in the browser
  (`Could not resolve "prettier"`), so the harness must not use it.

**Open:**

- Sharing one Chromium across projects through `connectOptions.wsEndpoint` was not tested.
- Per-project wall-clock time on an unloaded Linux CI runner. The Angular and Qwik numbers below
  were taken with other spikes running.
- A public Qwik settle API, or polling, before M2's interaction traces depend on it.

## Alternatives considered

- **One project with several `browser.instances`.** Instances share the parent's Vite config and
  vary only the browser, so per-target plugins are impossible.
- **One Vitest process per target.** It works, at about 1.1 s each, but it loses the single report
  and the parity matrix in one run, and repeats Vitest's startup seven times.
- **`vitest-browser-react`, `-vue` and `-svelte`.** They do not exist for Angular, Qwik or Astro,
  and each adapter here is 5–15 lines, so our own adapters keep the targets uniform.
- **`page.elementLocator(container)` as the view locator.** Its `.selector` is a snapshot (`div`,
  then `div >> nth=1`). After a DOM change, a command using it hit
  `strict mode violation: locator('div') resolved to 3 elements`.
- **Qwik `render(container, Component)`.** It silently rendered `<div q:container="resumed"></div>`.
  Wrapping the component in `jsx(Component, {})` fixed it.

## Evidence

- **`pnpm vitest run`, five projects:** `Test Files 19 passed | 1 skipped (20)`,
  `Tests 44 passed | 1 skipped (45)`. The skip is Astro's hygiene test, by capability. Every target
  rendered the same `<p>`, `toBeVisible()` passed, and the computed colour was `rgb(0, 128, 0)`.
- **An evidence test in the same run:** `servers in process: 5`, and plugin lists such as
  `["uf-fake","vite:vue","uf-fake:guard","uf-probe"]` and
  `["uf-fake","solid","uf-fake:guard","uf-probe"]`.
  `headless chromium processes alive: 5; version 153.0.8010.12`.
- **ARIA:** Playwright `ariaSnapshot` (through `iframe` and through `frame()`) and Vitest's
  `utils.aria` both printed `- paragraph: Hello, world!` for every target.
- **`UF_HYGIENE_STRICT=1`:** 4 tests failed with `[uf hygiene] 1 unexpected console message(s)`:
  React's `Each child in a list should have a unique "key" prop.`,
  `[Vue warn]: Failed to resolve component: MissingChild`, and simulated Svelte and Solid warnings.
- **Selector probe:** `selectors: a=div b=div >> nth=1 a(after prepend)=div >> nth=1`, then the
  strict mode violation above. `getByTestId` worked.
- **Timings, five projects and two cases:** in parallel 2.10, 2.30 and 2.64 s wall (Vitest
  `Duration` 1.4–1.6 s), with every project's files starting within 1151–1313 ms of each other.
  Sequential (`groupOrder` 0..4) 2.65–3.38 s (1.8–2.1 s). One project alone 1.06–1.22 s. A cold
  optimizer cache (`rm -rf node_modules/.vite`) 3.90 s, with no scan error and no reload. The
  `pnpm` launcher adds about 0.5 s.
- **Angular, Qwik, React and Solid (`pnpm exec vitest run`, 4 files and 4 tests):** all passed, at a
  load average of about 10. Cold: 3.1 s wall on the first run (Duration 1.8 s), 5.9 s later
  (3.5 s). Warm: 4.0–6.9 s (1.6–4.7 s). Single projects: 2.9–5.7 s.
- **Transformed code per project:** Angular `ɵɵdefineComponent` from ngtsc; Qwik
  `componentQrl(qrlDEV(() => import("./Hello.uf.tsx_Hello_uf_component_Pu61aqUpnug.js")))` plus a
  segment using `_jsxSorted`; React `jsxDEV` from `react/jsx-dev-runtime`; Solid `template()` from
  `solid-js/web`, wrapped by solid-refresh because that run left `hot` on.
- **Qwik:** `render(c, Hello)` gave `<div q:container="resumed"></div>`. `render(c, jsx(Hello, {}))`
  gave `<p class="greeting" q-d:q-hmr="">…`, and with `hmr: false` the clean `<p>`. Without
  qwikloader a click left `<output>0</output>` and `toHaveTextContent("1")` timed out; with it the
  output became `<output>1</output><span>Big</span>`. The default `srcDir` failed with
  `Qwik srcDir "…/src" not found`.
- **`pnpm typecheck` (tsgo 7.0.2):** the harness, the commands augmentation, `ProvidedContext` and
  the factory were clean. The only error was `class` in `Hello.uf.tsx` against React's JSX types,
  which is ADR-0023's subject.
