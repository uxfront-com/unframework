# ADR-0104: A project's `vite` config reaches `test`, `visual` and `preview`

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §4.4, §8.1, §8.5, §8.6, P7; ADR-0064, ADR-0075, ADR-0076, ADR-0086, ADR-0087, ADR-0088;
  amends ADR-0086 and ADR-0088

## Context

A styling engine reaches every output through the `virtual:` modules its own Vite plugin
registers (ADR-0064). The corpus wires its engines in by hand: `tests/integration/harness/engines.ts`
adds their plugins to every ssr and browser project and passes their declarations and plugins to
each toolchain through `ToolchainContext.declarations` and `ToolchainContext.plugins`.

A project had no way to do the same. `defineTestConfig` (ADR-0086) built its projects from the
target's fragment and the unplugin alone, with `extends: false`. `unframework visual` (ADR-0087)
runs those projects with `config: false`, and each `preview` server (ADR-0088) is a Vite server
with `configFile: false`. So a design system styled through an engine's plugin, like one on
Styleframe, couldn't test, render or preview a component with the published tools: every import
of `virtual:styleframe` failed to resolve, and Angular's ngtsc failed it with TS2307.

A plugin alone isn't always enough either. The corpus lists `@styleframe/runtime` in
`optimizeDeps.include`, because a dependency the browser finds mid-run reloads the page.

## Decision

- **`vite` in `unframework.config.ts`.** A function that returns a partial Vite config. Every
  server `unframework test`, `visual` and `preview` start calls it once, with `{ target, mode }`:
  `mode` is `browser` or `ssr` for a test project and `preview` for a preview server. It returns
  an object, or a promise of one. `resolveConfig` reports UF7002 for a `vite` that is no function.
- **A function, not an object.** Each server gets its own plugin instances: up to 14 for `test`
  and `visual` on seven targets, seven for `preview`, and Astro's render servers. A plugin may hold
  one server's state in its hooks, so a shared instance would leak it between them.
- **Merged, never replacing.** The project's `plugins`, flattened from any shape Vite's `plugins`
  takes, go first, before the unframework plugin. Every other key is merged after the toolchain's
  fragment with Vite's `mergeConfig`, so the project's scalars win and lists such as
  `optimizeDeps.include` add to the server's. `withProjectVite` in `@unframework.dev/testing/config`
  does this for both packages.
- **Keys the server owns are refused.** `root`, `base`, `cacheDir`, `test`, `configFile`,
  `envDir`, `server.host`, `server.port` and `server.strictPort` fail the start with a message
  that names each one. A `configFile` would load the project's `vite.config.ts`, and a
  `server.host` would put every preview server on the network. Other `server` keys, like
  `server.fs`, stay allowed, since a monorepo may need them.
- **Failures say why.** When the function throws, a promise it gives rejects, or it gives
  something that is no config or no plugin, the message names the field and the reason, since the
  CLI prints an error's message alone. The preview, whose servers all fail alike then, says so
  once, with every target that failed.
- **Astro's render server takes the plugins alone.** It is a server of the toolchain's own, which
  `ToolchainContext.plugins` reaches, and that slot carries plugins. It calls `vite` with the same
  target and mode as the project it belongs to, lazily, on its first render.
- **No declaration file from the project.** The harness writes one, with
  `declare module "virtual:*";` for each pass-through prefix it compiles with
  (`DEFAULT_PASS_THROUGH`), under the root's `node_modules/.cache/unframework/`, and passes it to
  every toolchain through `ToolchainContext.declarations`. Angular's ngtsc then takes any
  pass-through module. The packages ship `dist` alone, so the file is written at run time.
- The config's types stay in a file with no imports (ADR-0076). `ProjectViteConfig` is
  `{ plugins?: readonly VitePluginOption[] } & object`: it checks `plugins`, takes any other key,
  and takes Vite's own `UserConfig` where a project annotates its function with it.

The fixture project in `packages/testing/test/fixtures/project-plugins` names a plugin that serves
`virtual:uf-fixture`, and the runtime that module imports:

```ts
vite: () => ({
  plugins: [ufFixturePlugin()],
  // The runtime the plugin's module imports, bundled before the run starts.
  optimizeDeps: { include: ["parse5"] },
}),
```

## Consequences

**Positive:**

- A design system on any engine runs `unframework test`, `visual` and `preview` with no wrapper,
  no Vitest config and no declaration file of its own.
- The one field also covers what an engine needs beyond its plugin, like `optimizeDeps.include`
  or `resolve.alias`.

**Negative:**

- Inside Angular's compile, a pass-through module's exports are typed `any`. The project's own
  source check, `tsc --noEmit -p tsconfig.uf.json`, still reads the real types.
- Astro's render server gets no key but `plugins`. Passing the rest needs a change to
  `ToolchainContext` and `target-astro`, which this record leaves for later.
- A key Vite adds later that the server must own isn't refused until it joins the list.

## Alternatives considered

- **A field for plugins alone, a function that returns them,** the first form of this record. It
  covered no other key, so a project couldn't pre-bundle its engine's runtime.
- **A `viteFinal` that replaces the config, as Storybook's does.** A replacement can drop the
  unframework plugin or change `root` and the Vitest options, which breaks a run in ways no
  message explains. Merging keeps them, and the refused keys say why when a project tries.
- **`visual.viteConfig`.** `test` and `preview` start the same servers, so the field would miss
  them, or reach them under a misleading name.
- **A `declarations` field, or the project's tsconfig.** Only Angular reads declarations, and its
  compile needs to know that a module exists, not its types, which the source check already
  reads. A tsconfig would also bring in unrelated globals under Angular's strict options.
- **Load the project's `vite.config.ts`.** It would bring a host app's whole setup into every
  target's server, with framework plugins that claim the same ids as the target's own (ADR-0088).
