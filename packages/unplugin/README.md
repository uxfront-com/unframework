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

Any styling engine works through the virtual modules its own Vite plugin registers (plan §4.4,
ADR-0064). An import whose specifier starts with a `passThrough` prefix (`virtual:` by default)
reaches every output as written, and this plugin never resolves it: the engine's plugin does. Add
that plugin beside this one. Both run `enforce: "pre"` and neither claims the other's ids, so their
order doesn't matter. Styleframe, the engine the corpus tests with, is an example. We list its
plugin first, as its installation guide does:

```ts
import styleframe from "styleframe/plugin/vite";

export default {
  plugins: [styleframe(), unframework({ target: "vue" }), vue()],
};
```

```tsx
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
```

Styleframe's scanner reads utility classes in a `.tsx` file's `className` only. For utilities
written in a `.uf.tsx` file's `class`, give it an extractor that reads `class` too, as the
integration harness does (`sourceUtilities` in `tests/integration/harness/styleframe.ts`).

## Options

| Option        | Meaning                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `target`      | A built-in target's name (`"react"`, `"vue"`, `"svelte"`, `"solid"`, `"angular"`, `"qwik"`, `"astro"`) or a third-party `Target`.                                                                                                                                                                            |
| `extension`   | What module ids append to the `.uf.tsx` path. Built-in targets have one; a third-party target must set it.                                                                                                                                                                                                   |
| `onCompile`   | Called each time a module loads, with `{ id, file, target, files, diagnostics }`. Returning a string (or a promise of one) fails that module with it: the integration harness's golden guard.                                                                                                                |
| `plugins`     | Compiler plugins, passed to `compile()` (the harness's canaries).                                                                                                                                                                                                                                            |
| `format`      | Formats the output with oxfmt. Defaults to `true`, so a module's code equals the golden file byte for byte.                                                                                                                                                                                                  |
| `passThrough` | The specifier prefixes whose imports pass through to every output as written, passed to `compile()`. Defaults to `["virtual:"]`; a list replaces it, as `["virtual:", "styled-system/"]` adds an engine that generates files. A prefix that is empty, relative or absolute fails when the plugin is created. |

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
  `.tsx` and `.ts` files are joined into one module (an import of a file of the join is left out,
  an import an earlier file already made is written once, and any other name two files declare
  or export is an error). A shared `.ts` module's copy (ADR-0070) is no component's file, so no
  join holds it: the output imports the module itself. On a markup target the module id loads the file's main component (its
  default export, or its only exported component), and each other component loads under a
  component id, `<abs>/X.uf.tsx.<output file>` (`/src/Card.uf.tsx.CardIcon.vue`, ADR-0053),
  which ends in the extension the framework's plugin claims.
- Until M5, that error stops two components that share a type declaration: each output declares
  the types its props reach, so `joinModules` reports the type as "declared by A.tsx and B.tsx"
  (ADR-0034). Two outputs that print the same inline helper, such as React's `cx`, clash the same
  way, and so do two imports from one framework that name different sets (Angular's
  `Component` beside `input`, Solid's `Show` beside `For`): only an identical import is written
  once. Give each such component its own `.uf.tsx` file.
- A script module keeps the `.uf.tsx` file's exports. A `.vue`, `.svelte` or `.astro` module has
  only a default export, so markup targets refuse a main component exported by name
  (`export function Hello`), rather than load a module where `import { Hello }` finds nothing.
- `moduleId`, `parseModuleId`, `componentId`, `parseComponentId` and `idSuffix` build and take
  these ids apart.
- **The project** (ADR-0071). Every file compiles through one project graph (`createProject`, from
  `@unframework/compiler`) rooted at Vite's root, shared by every module the plugin loads. Before
  a load, the plugin compares each file the module reaches through the project's edges with what
  the project last read of it, and hands the changed ones to the project's `update`, which
  compiles again only the modules whose inputs changed and stops where a shape is unchanged. So
  a compile is reused while its file and every file it reached hold what they held, with or
  without Vite's watcher. A package's types are read once per server, since Vite's watcher
  ignores `node_modules`. The outputs a load sees hold the copies of the shared `.ts` modules
  the file reaches (ADR-0070), as `compile()`'s do, so the golden guard judges them.
- **Children** (ADR-0053). The project resolves a file's imports, so a parent lowers its children
  by their APIs. An output imports a child's output by its file
  (`./Field.vue`): such a relative import from one of the plugin's modules, or from a segment
  Qwik's optimizer splits off one (`Form.uf.tsx_Form_component_<hash>.js`), is looked up in the
  importer's compile and resolves to the child's module id, or its component id on a markup
  target where it is not its file's main component.
- **Types** (ADR-0067). The project reads types through one syntactic type oracle created at
  Vite's root (`createSyntacticOracle`, from `@unframework/compiler`): a props type may come from
  another file or a package, and a child's API from its types' shapes. The oracle follows the
  source's imports, so it may read a TypeScript file outside the root.

- **Composables** (ADR-0069). A `.uf.ts` file loads under its absolute path plus the suffix the
  framework's plugin claims for a TypeScript module (`COMPOSABLE_ID_SUFFIXES`):

  | Target                   | Module id of `useToggle.uf.ts`   | Claimed by                                                    |
  | ------------------------ | -------------------------------- | ------------------------------------------------------------- |
  | React, Vue, Solid, Astro | `/abs/useToggle.uf.ts`           | Vite's own TypeScript transform                               |
  | Qwik                     | `/abs/useToggle.uf.ts`           | Qwik's optimizer                                              |
  | Svelte                   | `/abs/useToggle.uf.ts.svelte.ts` | vite-plugin-svelte, which compiles runes in `.svelte.ts` only |
  | Angular                  | `/abs/useToggle.uf.ts.ts`        | `ngtscVirtual`                                                |

  A third-party target's composables load under the `.uf.ts` id. The id loads every composable
  the target's `emitComposable` emitted for the file, joined into one module. An output's relative
  import of a composable's output (`./useToggle`, `./useToggle.svelte.ts`, `./use-toggle`) is
  looked up in the importer's compile, as a child's is, and resolves to the module's id. A target
  without `emitComposable` fails the module with UF1002 until its composables lane lands.
  `composableIdSuffix`, `composableId` and `parseComposableId` build and take these ids apart.

How `resolveId` answers:

- **An import of a `.uf.tsx` file** resolves through Vite (so aliases work), then gets the suffix.
  What decides is the file the specifier resolves to, so the forms TypeScript accepts for it,
  `./Hello.uf` (`moduleResolution: "bundler"`) and `./Hello.uf.js` or `./Hello.uf.jsx`
  (`"nodenext"`), compile like `./Hello.uf.tsx`. An import of a `.uf.ts` file, or a `./X.uf` that
  resolves to one, gets the composables' suffix. A query stays on the id (`./Hello.uf.tsx?container` loads
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
- **A scoped sheet** (ADR-0063), `./Hello.uf.tsx.css`, which every target's output imports for
  a component with a stylesheet, resolves to `/abs/Hello.uf.tsx.css` with its query, from one of
  the plugin's modules or a segment Qwik's optimizer splits off one (`?inline`), and so does its
  id coming back. It is checked before an output's import of another output, and it is no
  component's output, so `owners` never names it. The id ends in `.css`, without a `\0`, so
  Vite's CSS pipeline handles it; from any other importer it is left to Vite, which finds no
  such file.
- **The watch edges** (ADR-0071). The pre plugin's `transform` calls
  `this.addWatchFile(<abs>.uf.tsx)` for every id but one that is the file itself. Vite resolves
  that file with the module as its importer, and the plugin answers with the real file, so the
  module graph holds the file as an import of the module: editing it invalidates the module and
  reruns `vitest --watch`. (In `load`, Vite would drop the file when a cold request's module is
  not in its graph yet.) It adds an edge to every file the project says the output depends on,
  directly or through another module: each child's `.uf.tsx`, each composable's `.uf.ts`, each
  shared `.ts` module, each stylesheet and each file a type was read from. So an edit to
  `Field.uf.tsx` invalidates `Form`'s module, and an edit to the `.ts` file that declares a props
  type invalidates every module that reads the type, through a composable too. A module of
  composables gets the same edges. A file that does not exist yet gets none, since Vite's import
  analysis fails an import it cannot resolve: once created, it reaches its dependents on their
  next load. Hot updates are M6's.

`load` answers a scoped sheet's id with the sheet this target's compile emitted, whatever its
query: plugin-vue's request for `<style src>` (`?vue&type=style&index=0&src=true&lang.css`), which
the plugin serves before plugin-vue reads the disk, and Qwik's `?inline` give the same text. The
author's `Hello.css` is never loaded: no output imports it. A file that imports no stylesheet has
no sheet, and its sheet id fails. No edit of the author's sheet invalidates the sheet module
until M6.

How `load` answers any other query is decided by the query alone, never by what the process resolved
before: a parameter named after the id's extension (`?vue&type=style&index=0&lang.css`,
`?svelte&type=style&lang.css`, `?astro&type=script…`) is the framework plugin's request for a part
of the module, which `load` leaves to that plugin; Vite's file queries are left to Vite; any other
query (`?container`) loads the component, even on a cold server.

An import whose specifier does not name the file never reaches `resolveId`: a package's `exports`
entry or a tsconfig path that maps to a `.uf.tsx`. On React, Solid and Qwik the resolved id is the
module id, so it compiles anyway. On the other targets the authored file would load as plain TSX,
so `load` fails it with the fix: import it with a specifier that ends in `.uf.tsx`. A `.uf.ts`
file mapped that way loads as its composables where its id is the file itself, and fails the same
way on Svelte and Angular, whose ids have a suffix. Packages that
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

It exposes `api.getSheet(file)` too: the scoped sheet this target's last finished load of the
`.uf.tsx` file emitted, after the plugins' `output` hooks, or `undefined` when no load finished or
the file imports no stylesheet (ADR-0063). Vite never loads an Angular component's sheet: ngtsc
reads its `styleUrl` itself, so `ngtscVirtual` hands it the sheet from here.

The project caches each file's compile, so every id of a file shares one compile until the file,
or a file it reached, changes.
