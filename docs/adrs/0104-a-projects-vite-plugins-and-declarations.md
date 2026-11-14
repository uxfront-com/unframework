# ADR-0104: Project Vite plugins and declarations reach `test`, `visual` and `preview`

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
target's fragment and the unplugin alone, with `extends: false`, and passed neither field to the
toolchains. `unframework visual` (ADR-0087) runs those projects with `config: false`, and each
`preview` server (ADR-0088) is a Vite server with `configFile: false`. So a design system styled
through an engine's plugin, like one on Styleframe, couldn't test, render or preview a single
component with the published tools: every import of `virtual:styleframe` failed to resolve, and
Angular's ngtsc failed it with TS2307.

## Decision

- **Two fields in `unframework.config.ts`.** `vitePlugins` is a function that returns the
  project's Vite plugins, in any shape Vite's `plugins` takes: a plugin, a list, nested lists,
  promises and `false`, `null` or `undefined` for none. `declarations` lists the ambient
  declaration files that type those modules, relative to the config's directory.
  `resolveConfig` reports UF7002 for a `vitePlugins` that is no function and for a
  `declarations` that is no list of paths. A declaration file need not exist when the config
  loads, since an engine may generate it as its plugin starts.
- **A function, not a list.** Every Vite server a run starts calls it for a set of its own: one
  per browser and ssr project, one per preview server, and Astro's render servers through
  `ToolchainContext.plugins`. A plugin may hold one server's state in its hooks, so a shared
  instance would leak it between them.
- **Where they go.** `defineTestConfig` adds the plugins before the unplugin in every `browser:`
  and `ssr:` project, as the corpus does, and passes `plugins` and `declarations` to each
  toolchain's `ToolchainContext`. `visual` builds its projects with `defineTestConfig`, so it
  takes them too. Each preview server adds them after its own plugin and before the unplugin,
  and passes both fields to the toolchain. `projectPlugins` in `@unframework.dev/testing/config`
  turns the function into what `ToolchainContext.plugins` takes, and throws, naming the field and the reason, when it throws, a promise it gives rejects, or it gives something that has no `name`, since the CLI prints an error's message alone. The preview, whose servers all fail alike then, says so once, with every target that failed.
- The config's types stay in a file with no imports (ADR-0076), so `VitePluginOption` stands for
  Vite's `PluginOption` by its shape: anything with a `name`. Every Vite plugin matches it.

The fixture project in `packages/testing/test/fixtures/project-plugins` names a plugin that serves
`virtual:uf-fixture`, and the file that types it:

```ts
export default {
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  vitePlugins: () => [ufFixturePlugin()],
  declarations: ["../uf-fixture.d.ts"],
};
```

## Consequences

**Positive:**

- A design system on any engine runs `unframework test`, `visual` and `preview` with no wrapper
  and no Vitest config of its own.
- The fixture tests in `packages/testing` and `packages/visual` prove it on all seven targets with
  a module only a fixture plugin serves, and show the import fails without the plugin.

**Negative:**

- The plugins run in every server a run starts, up to 14 for `test` on seven targets, so a slow
  plugin slows each one.
- `defineTestConfig` loads the config once per run, and Node caches the module it imports, so a
  run sees an edit to `vitePlugins` only when it starts again.

**Open:**

- `build --package` still doesn't resolve pass-through modules, and type-only imports from them
  aren't read by the oracles. Both stay outside this record.

## Alternatives considered

- **A `plugins` list on `defineTestConfig`.** It reaches `test` alone: `visual` and `preview`
  read only `unframework.config.ts`, so a project would configure one engine in two places.
- **Load the project's `vite.config.ts`.** It would bring a host app's whole setup into every
  target's server, with framework plugins that claim the same ids as the target's own (ADR-0088).
- **A list of plugin instances.** One set shared by 14 servers leaks state between them, so the
  config takes a function.
- **The field name `plugins`.** `compile()` already has `plugins` for its `ir` and `output`
  hooks, so the config names the Vite ones `vitePlugins`.
