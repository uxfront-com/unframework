# ADR-0076: Configuration and the CLI

- **Status:** Accepted
- **Date:** 2026-11-10
- **Plan:** §5.2, §5.10, §8.1, §8.3, §9 M6; P2, P8; ADR-0016, ADR-0073, ADR-0077; defers ADR-0071's
  open item on the IR cache, without editing that record

## Context

M6 adds `unframework.config.ts` (§8.1), and the CLI's `build`, `check`, `explain` and `init` (§8.3),
with `create-unframework`. ADR-0016 puts `defineConfig` under `unframework/config` and the bin in
`unframework`, whose root export stays types and stubs only. `LAYERS` already holds a slot for
`@unframework/cli`, beside `unplugin`, and one for `create-unframework` above `testing`. Plan §5.2
gives `create-unframework` no dependencies.

The rest of §8.3 waits for later milestones: `test`, `visual` and `preview` (M7), `manifest` and
`fix` (M9). This record differs from §8.3 in one point: `init` writes no test file, because
`@unframework/testing` stays private until M7. It also leaves out the IR cache that ADR-0071's open
item expected with the CLI (Alternatives).

This record is proposed before M6 builds it. Each section below is amended in place as its part is
built.

## Decision

### Configuration

- `packages/compiler/src/config.ts` exports `loadConfig(root, file?)`, which imports `file`, or the
  first of `unframework.config.{ts,mts,js,mjs}` it finds in `root`, through Node's type stripping. A
  load failure, `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` included, reports UF7001 `config-not-loaded` with
  the path, and so does a file with no default export. Node gives a CommonJS file an empty `default`
  when it exports nothing, so an empty `module.exports` counts as no default export too. A project
  with no config file takes the defaults, with no diagnostic.
- It exports `resolveConfig(raw, origin?)`, which checks:
  - the shape of §8.1's fields and `package?: { targets?: TargetName[]; resolveFrom?: string | Partial<Record<TargetName, string>> }`,
    with relative paths resolved against the config's directory (UF7002 `config-invalid`, with a
    JSON pointer). A field the config doesn't have, an empty target list, a repeated target and a
    `package.targets` entry outside `targets` report it too
  - the target names (UF7003 `unknown-target`, with a did-you-mean)
  - `targetOptions[t]`, through the target's Standard Schema (UF7004 `target-options-invalid`). A
    schema that throws reports it too
- `origin` is what `loadConfig` returned: `directory` and `file`. `raw` alone doesn't say where the
  config lives, and relative paths need it.
- `resolveConfig` is asynchronous, because a Standard Schema's `validate` may return a promise. What
  a schema returns replaces the options as written. A target without a schema takes no options, so
  any key under it reports UF7004, whose message says so (`react` declares no options): nothing
  would read them (P2). Every built-in target declares none today, so §8.1's
  `react: { compiler: true }` reports UF7004 until React declares that option.
- The defaults are all seven targets, `src`, `dist`, `syntactic` and `strict: false`.
- `unframework/config` exports an identity `defineConfig`, typed with `UnframeworkConfig` through a
  type-only import, so importing it loads no compiler (ADR-0016).
- The config's types live in `packages/compiler/src/config-types.ts`, which has no imports, behind the
  subpath `@unframework/compiler/config-types`, and the compiler's index re-exports them. Through the
  index, type-checking a config would read the compiler's whole type graph, and
  `@typescript-eslint/types` doesn't check under `skipLibCheck: false`.
- Only the CLI reads the config. The bundler plugin takes explicit options, or detects the target
  (ADR-0075).

```ts
// unframework.config.ts
import { defineConfig } from "unframework/config";

export default defineConfig({
  targets: ["react", "vue"],
  srcDir: "src",
  outDir: "dist",
});
```

### CLI

- `@unframework/cli` exports `main(argv, io?)` over a command table, parsed with `node:util`'s
  `parseArgs`. `io` holds the working directory and the two output streams, and defaults to the
  process's, so a test or a caller needs no child process. Each command loads when it runs, so
  `explain` starts without the compiler. `packages/unframework/bin/unframework.js` imports the CLI
  lazily, and the umbrella's `files` include `bin`.
- The exit codes are 0 for success, 1 for error diagnostics and 2 for a usage or config error, or a
  failure writing a file. UF7007 is an error diagnostic, so it exits 1.
- `build` globs `srcDir/**/*.uf.{tsx,ts}`, sorted (P8), skips `node_modules` and `outDir` (`glob` itself
  doesn't enter a symlinked or a dot directory, or one it can't read), and
  compiles through `createProject` (ADR-0071). `--type-oracle tsgo` lazily imports the tsgo oracle,
  and overrides the config's `typeOracle`. No sources reports UF7007 `no-sources`. Under `strict`, a
  `UF4xxx` warning counts as an error (§8.1).
- `build` cleans each `outDir/<target>`, then writes the outputs and `project.copies` in the
  directories their sources have under `srcDir`, and a barrel per target, `index.ts`, which exports
  each exported component and composable by name. A JS or TS output that has a map also gets a `.map`
  sidecar and a trailing `//# sourceMappingURL=` comment. Apart from that comment, each file equals
  `compile()`'s output byte for byte. A copy has no map, since a project's `copies` give none.
- A sidecar's `sources` name the source relative to where the file was written, which `compile()`
  can't know, so the map stays true outside `srcDir`.
- A build with an error diagnostic, or with a config it refuses, cleans and writes nothing, so the
  last good build stays in place. A failure while writing exits 2 with the build half written.
- `build` and `check` share a compilation, so `check` fails wherever `build`'s compile would. It holds source
  maps too, since a map that can't follow formatting is an error (UF9002). It reports what no single
  compile can see, with the nearest codes in the catalogue. Their catalogue text doesn't name these
  cases, so each message says what the problem is and how to fix it:
  - UF1104, for two modules that would write one file, one barrel name from two files, or a module
    that would write the barrel's `index.ts`. Equal outputs don't excuse two modules: only a shared
    module reached from two importers is one file.
  - UF7002 at `/outDir`, for an `outDir/<target>` that holds the project, a source, or a file a
    source read, since cleaning it would delete them.
  - UF7002 at `/srcDir`, for a child the glob didn't find, inside `srcDir` or not, or a shared module
    above `srcDir`, which a tree mirroring `srcDir` can't hold beside its importer.
- `check` takes `--format pretty|json|sarif`, through the renderers `@unframework/diagnostics`
  already has (`formatDiagnostics`, `toJsonDiagnostics`, `toSarif`). It prints a config's diagnostics
  in that format too, on standard output.
- `explain` prints a code's catalogue entry and its `docsUrl()`. An unknown code exits 2.

### init and create-unframework

- `unframework init` writes `unframework.config.ts`, `src/Button.uf.tsx` with `src/Button.css`,
  `tsconfig.uf.json` (ADR-0073) and an `AGENTS.md` that points at unframework.dev. It holds them as
  strings in the CLI, so they ship in `dist` with no copy step.
- It refuses to overwrite a file without `--force`. It checks before its first write, so a refusal
  exits 2, names every file in the way, says what `--force` would do with each and writes nothing. A dangling symlink counts as a
  file, since writing through it would create one elsewhere. A `unframework.config.{mts,js,mjs}`
  counts too, since `loadConfig` takes the `.ts` file first and would drop that config without a word.
  `--force` overwrites the five files, replaces a symlink rather than writing through it, and touches
  nothing else, so the `.ts` file then wins, and `init` says so on standard error. A directory in a file's place exits 2 even with `--force`.
- The example has a stylesheet, so `check` prints UF4002 as an info for Angular and for Qwik, and
  exits 0. Any stylesheet does that.
- The example's config is an ES module, and `loadConfig` can't change how Node reads a `.ts` file. So
  in a project whose `package.json` sets `"type": "commonjs"`, which `npm init -y` writes, `check` and
  `build` exit 2 with UF7001. The fix is `"type": "module"`, or renaming the file
  `unframework.config.mts`. The `package.json` that `create-unframework` writes sets `"type": "module"`.
- `create-unframework <dir>` writes a private ES module `package.json` with `unframework` as a
  dependency, at `latest`, then runs the project's own `unframework init`, passing on its output and
  exit code. It keeps no dependencies of its own (§5.2). An existing `package.json` exits 2 and stays
  as it is.
- "The project's own" means the bin of `<dir>/node_modules/unframework`, and nothing else: an
  ancestor's copy or one on `NODE_PATH`, which pnpm's bin shims set, isn't the project's.
- `create-unframework` installs nothing, since the name on npm isn't ours yet (Consequences). With no
  such bin it exits 1 once the `package.json` is written, and says to install the dependencies and
  run `unframework init`.

## Consequences

**Positive:**

- A config runs on Node as it is, with no bundler or loader between it and the user's code.
- `check` gives agents and CI the same diagnostics as a person, in JSON or SARIF, and its exit codes
  tell a broken component from a broken command line.
- `build`'s files equal `compile()`'s, so what the corpus verifies holds for them.

**Negative:**

- Type stripping refuses what it can't erase, so a config with an `enum` fails with UF7001 and not a
  working default. The message has to say why.
- `unframework.config.ts` has no effect on the plugin, and the docs have to say so.
- `unframework` now depends on `compiler` and `cli`, so installing the authoring API installs the
  tooling. Lazy imports protect the root export's load time, not the install's size.
- The name `unframework` on npm belongs to a third party, so `create-unframework`'s dependency can't
  resolve from the registry until a release plan settles the name. Nothing publishes in M6.

## Alternatives considered

- **A config loader such as `jiti` or `c12`.** It would accept any TypeScript syntax, at the cost of
  a dependency, while the repository itself runs on Node's type stripping.
- **The plugin reading `unframework.config.ts` too.** A plugin instance serves one target, so most
  of the config's fields mean nothing to it, and it already takes explicit options.
- **A CLI framework.** `parseArgs` covers four commands and a few flags, and needs no dependency.
- **`init` scaffolding a test,** as §8.3 says. `@unframework/testing` isn't public until M7.
- **§5.10's IR cache as JSON in M6.** ADR-0071 expected it to come with the CLI. It's left out, since
  `build` runs through the project graph without it, and a later issue can add it.
- **`build --watch`.** It's left out too, for a later issue.
