# ADR-0088: `unframework preview` shows every example on every target, one Vite server each

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §5.7, §8.3, §8.6, §9 M7; ADR-0020, ADR-0053, ADR-0067, ADR-0083, ADR-0086, ADR-0087

## Context

Plan §8.6 asks for `unframework preview`: a shell page with one iframe per target, each served by a
Vite server of its own, and shared prop controls, for people and for agents taking screenshots.
`unframework visual` (ADR-0087) renders the examples, but in Vitest, once, and only to compare them.
Nothing showed a component or an example on seven targets at once while you work on it.

The pieces exist. Each target's `/toolchain` gives the Vite fragment of a browser project
(`vite("browser")`) and a mount adapter, and `defineTestConfig` (ADR-0086) shows how a project's
browser projects are built from them, with the unframework plugin first. Two of them are bound to
Vitest:

- Astro's adapter renders through the Vitest browser command `ufAstroRender`, imported from
  `vitest/browser`, a module that throws when it loads anywhere but Vitest's browser mode.
- Astro's browser fragment closes its render servers from Vitest's `configureVitest` hook.

The other six adapters import no Vitest. ADR-0083 kept an earlier preview on a Storybook branch off
`main`, and its Astro adapter took a `renderCommand` that every caller had to pass.

## Decision

- **One Vite dev server per target, and a shell server.** `startPreview({ root, targets?, port?,
toolchainDirs? })` in `@unframework.dev/visual` starts a dev server for each of the project's
  targets, or the ones asked for: the unframework plugin with that target, the target's
  `vite("browser")` fragment, and the preview's own plugin. Each listens on `127.0.0.1` on a port
  the system picks, so each frame has an origin of its own, and keeps its dependency cache in
  `node_modules/.vite/uf-preview-<target>`. A plain HTTP server serves the shell page at `/` on
  `port`, any free one by default. It resolves to `{ url, frames, close }` once every server
  listens, and `close()` stops them all. A start that fails closes what it started.
- **What each target's server serves.** `/__uf/frame` is the frame page, run through
  `transformIndexHtml`, so the framework plugins add their preambles. Its module mounts the
  selection with the target's own adapter, which it imports by path, resolved from the testing
  package, since a project need not install the target packages. It loads each entry lazily, so a
  target compiles only what is shown. A new selection mounts into a fresh container, since Qwik
  refuses to render twice into one.
- **The protocol.** The shell and its frames talk through `postMessage`, each message marked
  `type: "unframework:preview"`. The shell sends `{ kind: "render", seq, entry, props }`, and a
  frame answers `{ kind: "rendered" | "failed", target, seq, message? }`. A frame says
  `{ kind: "ready", target }` on every load, and the shell then sends it the current selection, so
  a reload after Vite optimises a dependency it found recovers by itself. The same entry with new
  props rerenders in place, through the adapter's `rerender`. Each side checks the other's origin
  and window: the shell passes its origin in the frame's URL (`?shell=`), and the shell takes
  answers only from its iframes, at their servers' origins.
- **Controls (A4 of the M7 plan).** The shell lists the examples, which `discoverExamples` finds,
  and the components: the default export of each `.uf.tsx` file under `srcDir`, read through the
  file resolver with the syntactic type oracle (ADR-0067). A prop gets a control when its type is
  `boolean`, `string`, `number` or a union of string literals, read from `ApiMember.type` and, for
  an alias, its resolved `literals`. `| undefined` makes it optional. An optional prop starts
  unset, so the component's own default applies, and its control offers "(default)". A required
  prop starts at `false`, `""`, `0` or the first literal. Every other prop is named as not
  controllable, with its type, and so is a type the API spells but doesn't resolve, like an alias
  the oracle can't read. Models and slots get no control: the preview passes props alone, so a
  component's slots render empty.
- **Astro outside Vitest.** `MountOptions.renderCommand` (in `@unframework.dev/codegen`) is the
  page's way to reach a server render. Astro's adapter calls it when a host passes it, and Vitest's
  `ufAstroRender` command otherwise, so the test projects work as before. A toolchain names the
  command it renders through (`renderCommandName`) and closes what its commands started (`close`).
  The preview runs that command in Node behind `POST /__uf/render` on the target's own server, with
  the part of Vitest's command context the command reads, the server that serves the page
  (`project.browser.vite`). The endpoint takes only a JSON body of at most 1MB. Every preview server
  serves an empty module for `vitest/browser`, so the adapter's import of it loads.
- **Vite's TypeScript transform stays on.** Each server sets Vite's `oxc` option, because Analog's
  Angular plugin turns the transform off unless a configuration sets it (`config.oxc ?? false`),
  and outside Vitest nothing else strips the types of the adapter and the frame.
- **Where the toolchains resolve from.** `toolchainDirs` defaults to `package.resolveFrom` in
  `unframework.config.ts`, then the root, as for `defineTestConfig` (A9 of the M7 plan), and the
  command reads it from there.
- **`unframework preview [--target <t>]… [--port <n>]`**, registered by the umbrella beside
  `test` and `visual`, prints the shell's URL and each target's origin, runs until SIGINT or
  SIGTERM, then closes every server and exits 0. A second signal while it closes exits 130. A usage
  error, a project with nothing to show or a configuration that won't load exits 2.
- **Development only.** The preview binds to `127.0.0.1` and writes nothing under the sources: its
  only writes are Vite's caches under `node_modules/.vite` and Angular's `.uf-tmp/` beside its
  compiler stack.
- **`vite` is a peer dependency of `@unframework.dev/visual`**, as it is of the unplugin, so a
  project keeps one copy of Vite. The package also depends on the unplugin, the IR and codegen
  (for types), and exports the frame runtime as `./frame`, which only the preview's servers load.

## Consequences

**Positive:**

- People and agents see a component or an example on every target at once, and a screenshot of the
  shell shows all seven.
- The preview runs each target's own toolchain, the same pieces as the test projects, so what it
  shows is what the tests and `visual` render.
- Astro's adapter no longer needs Vitest to render, and Vitest still needs nothing new from it.

**Negative:**

- Seven dev servers take seven ports and the memory of seven Vite pipelines.
- A frame may reload once while Vite optimises a dependency it found, and the shell sends the
  selection again.
- Slots render empty and models can't be set, so a component that shows its content through them
  shows little. An example shows them.
- The render endpoint runs a render for any page on `127.0.0.1` that can send JSON to it. It only
  renders what the server has compiled, and only on this machine.

**Open:**

- Controls for models and events, and filled slots, could come from the component manifest
  (§8.8).

## Alternatives considered

- **One Vite server for every target.** One origin would let the frames share globals, and every
  framework's plugin would claim the same `.uf.tsx` ids in one pipeline. §8.6 names one server each.
- **Astro's adapter requires `renderCommand`**, as on the Storybook branch. Every test project would
  have to pass it, and the testing package's `mount` would learn about a target's transport. A
  default keeps the corpus untouched.
- **Loading `vitest/browser` lazily in Astro's adapter.** Vite still resolves the import, so a page
  outside Vitest fails where the project can't resolve `vitest`. An empty module in the preview's
  servers costs nothing.
- **Running the preview inside Vitest's browser mode.** Vitest serves tests, not a page you keep
  open, and its runner owns the iframe.
