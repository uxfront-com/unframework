# @unframework/unplugin

The Unframework bundler plugin (plan §8.2). An import of a `.uf.tsx` file compiles it to one
framework's source with `compile()` from `@unframework/compiler`, under a module id that the
framework's own Vite plugin claims, and that plugin finishes the job.

```ts
// vite.config.ts
import unframework from "@unframework/unplugin/vite";
import vue from "@vitejs/plugin-vue";

export default {
  plugins: [unframework({ target: "vue" }), vue()],
};
```

```ts
import Hello from "./Hello.uf.tsx"; // a Vue component
```

`unframework(options)` returns two plugins, `[pre, post]`. Put them before the framework's
plugins. Only Vite is supported until M6; `unframeworkUnplugin` (the `.` entry) refuses any other
bundler when the plugin is created.

## Options

| Option      | Meaning                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`    | A built-in target's name (`"react"`, `"vue"`, `"svelte"`, `"solid"`, `"angular"`, `"qwik"`, `"astro"`) or a third-party `Target`.                                                             |
| `extension` | What module ids append to the `.uf.tsx` path. Built-in targets have one; a third-party target must set it.                                                                                    |
| `onCompile` | Called each time a module loads, with `{ id, file, target, files, diagnostics }`. Returning a string (or a promise of one) fails that module with it: the integration harness's golden guard. |
| `plugins`   | Compiler plugins, passed to `compile()` (the harness's canaries).                                                                                                                             |
| `format`    | Formats the output with oxfmt. Defaults to `true`, so a module's code equals the golden file byte for byte.                                                                                   |

## Module ids

A module id is the absolute path of the `.uf.tsx` file plus the target's suffix (`ID_SUFFIXES`):

| Target             | Module id                  | Claimed by                                |
| ------------------ | -------------------------- | ----------------------------------------- |
| React, Solid, Qwik | `/abs/Hello.uf.tsx`        | the JSX transform, which claims `.tsx`    |
| Vue                | `/abs/Hello.uf.tsx.vue`    | plugin-vue                                |
| Svelte             | `/abs/Hello.uf.tsx.svelte` | vite-plugin-svelte                        |
| Astro              | `/abs/Hello.uf.tsx.astro`  | Astro's plugin                            |
| Angular            | `/abs/Hello.uf.tsx.ts`     | `ngtscVirtual` (Analog only claims `.ts`) |

- The code comes from `load`, never `transform`: nothing exists on disk at a module id, and every
  framework plugin compiles the code it is given. Ids never start with `\0`, which the framework
  plugins skip.
- An id loads the target's output file with the id's extension (`Hello.vue`, `hello.ts`, and
  `Hello.tsx` for a `.uf.tsx` id). A file with several components emits one such file each:
  `.tsx` and `.ts` files are joined into one module (an import an earlier file already made is
  written once, and any other name two files declare or export is an error), and markup targets
  refuse the file until M3.
- Until M5, that error stops two components that share a type declaration: each output declares
  the types its props reach, so `joinModules` reports the type as "declared by A.tsx and B.tsx"
  (ADR-0034). Two outputs that print the same inline helper, such as React's `cx`, clash the same
  way, and so do two imports from one framework that name different sets (Angular's
  `Component` beside `input`, Solid's `Show` beside `For`): only an identical import is written
  once. Give each such component its own `.uf.tsx` file.
- A script module keeps the `.uf.tsx` file's exports. A `.vue`, `.svelte` or `.astro` module has
  only a default export, so markup targets refuse a component exported by name
  (`export function Hello`) until M3, rather than load a module where `import { Hello }` finds
  nothing.
- `moduleId`, `parseModuleId` and `idSuffix` build and take these ids apart.

How `resolveId` answers:

- **An import of a `.uf.tsx` file** resolves through Vite (so aliases work), then gets the suffix.
  What decides is the file the specifier resolves to, so the forms TypeScript accepts for it,
  `./Hello.uf` (`moduleResolution: "bundler"`) and `./Hello.uf.js` or `./Hello.uf.jsx`
  (`"nodenext"`), compile like `./Hello.uf.tsx`, and a `./Hello.uf` that resolves to a `.uf.ts`
  file is left alone. A query stays on the id (`./Hello.uf.tsx?container` loads
  `/abs/Hello.uf.tsx.astro?container`), except Vite's `?raw`, `?url`, `?worker` and
  `?sharedworker`, which mean the authored file.
- **A module id coming back** maps to the absolute id with its query: an absolute id from a plugin,
  a root-relative URL from the browser (`/cases/hello/Hello.uf.tsx.vue`), or a path relative to
  its importer (`./Hello.uf.tsx.vue`). Ids keep Vite's forward slashes on every platform.
- **The dependency scan** (`scan: true`, set by Vite's optimizer and missing from its public type)
  gets `\0uf-scan:<abs>` (`SCAN_ID_PREFIX`). The scanner reads every id it gets from disk with its
  own loaders, so a module id would fail the whole scan, and the authored file would expose its
  compile-time imports as dependencies; it externalises ids that contain `\0`. Each target's
  toolchain lists the runtime imports of its compiled output in `optimizeDeps.include` instead.
- **The watch edge.** The pre plugin's `transform` calls `this.addWatchFile(<abs>.uf.tsx)` for
  every id but a `.tsx` one. Vite resolves that file with the module as its importer, and the
  plugin answers with the real file, so the module graph holds the file as an import of the
  module: editing it invalidates the module and reruns `vitest --watch`. (In `load`, Vite would
  drop the file when a cold request's module is not in its graph yet.)

How `load` answers a query is decided by the query alone, never by what the process resolved
before: a parameter named after the id's extension (`?vue&type=style&index=0&lang.css`,
`?svelte&type=style&lang.css`, `?astro&type=script…`) is the framework plugin's request for a part
of the module, which `load` leaves to that plugin; Vite's file queries are left to Vite; any other
query (`?container`) loads the component, even on a cold server.

An import whose specifier does not name the file never reaches `resolveId`: a package's `exports`
entry or a tsconfig path that maps to a `.uf.tsx`. On React, Solid and Qwik the resolved id is the
module id, so it compiles anyway. On the other targets the authored file would load as plain TSX,
so `load` fails it with the fix: import it with a specifier that ends in `.uf.tsx`. Packages that
ship `.uf.tsx` sources (consumed through `exports` maps and Vite's dependency optimizer, which
bundles `node_modules` before any plugin runs) are M6's to support.

## Diagnostics and the guard

- Warnings and info diagnostics go to `this.warn`, with their code frame.
- Errors fail the module through `this.error`, with `formatDiagnostics` (uncoloured): every error's
  `UF` code, message and code frame.
- When `onCompile` returns a message, `load` still returns the compiled code, so the framework's
  plugin compiles it, and the post plugin replaces the module's final code with
  `throw new Error(message); export default undefined;` (plus the module's named exports). Its
  importers still link, and the message reaches the test report. Throwing from `load` would reach
  the browser as an HTTP 500, and Vitest would only report "Failed to fetch dynamically imported
  module". A check that throws, or returns an empty message, fails the module too.
- Verdicts are kept per Vite environment. One plugin instance serves a server's client and ssr
  environments, which load the same id concurrently, and each environment's post plugin reads the
  verdict on its own load.

## The `api`

The pre plugin, named `unframework`, exposes `api.getCompiled(id)`: the code of the last load of
a module id that finished, in any environment, or `undefined` when the id has not loaded or that
load failed. A load in progress never clears it. Angular's `ngtscVirtual` reads the virtual
sources of child components with it:

```ts
const api = config.plugins.find((plugin) => plugin.name === "unframework")?.api;
api.getCompiled("/abs/Child.uf.tsx.ts");
```

Compiles are cached per file and source content, so every id of a file shares one compile until
the file changes.
