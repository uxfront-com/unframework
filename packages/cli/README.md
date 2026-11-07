# @unframework/cli

The `unframework` command line (plan §8.3, ADR-0076). The `unframework` package's bin runs it, so a
project runs it as `unframework <command>`, from the directory that holds its
`unframework.config.ts`. A project with no config takes the defaults.

| Exit code | Meaning                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | Success, warnings and notes included, but for what `strict` makes an error.                                                             |
| 1         | Error diagnostics, in a source, because no source was found, or from a packager.                                                        |
| 2         | A usage error, `init`'s refusal, a config that won't load or is invalid, a project `--package` can't ship, or a failure writing a file. |

`main(argv, io?)` runs a command line, `argv` without Node and the script, and gives the exit code.
It never throws. `io` holds the working directory and where text goes, and defaults to the process's.

## build

```sh
unframework build [--package] [--type-oracle syntactic|tsgo]
```

`build` compiles each `srcDir/**/*.uf.{tsx,ts}` that Node's `glob` finds through the project graph, in
sorted order. It skips `node_modules` and `outDir`, and `glob` doesn't enter a symlinked or a dot
directory, or one it can't read. Then it cleans each `outDir/<target>` of the config's `targets` and
writes it:

- **The outputs,** in the directories their sources have under `srcDir`. Each file equals what
  `compile()` gives, byte for byte, but for the comment below.
- **The copy of each shared `.ts` module** a source reaches, unchanged, with no map.
- **A source map** for a JS or TS output that has one: `<file>.map` beside it, and a trailing
  `//# sourceMappingURL=<file>.map` comment. The sidecar names the source relative to where the file
  was written. Any other output, like a `.vue` file or a scoped sheet, gets neither, since the comment is written
  for JavaScript and TypeScript. Neither does a file that came without a map.
- **A barrel,** `index.ts`, which exports each exported component and composable under its name. A
  default export takes its component's name.

`--type-oracle` overrides the config's `typeOracle`. `tsgo` loads `@unframework/type-oracle-tsgo`
only then. With `strict` in the config, a portability warning (`UF4xxx`) counts as an error.

A successful build prints only its warnings and notes, on standard error. A build with an error diagnostic from a compile or from what `--package` checks first, or with a
config it refuses, cleans and writes nothing, so the last good build stays in place. A failure while
writing does exit 2 with the build half written. A packager that fails (UF7009) has the trees written,
and keeps the last good package.

`build` and `check` also report what no single compile can see:

- **UF7007:** `srcDir` holds no source.
- **UF1104:** two modules would write one file, without case and extension as an output imports
  it, or a target's barrel would export one name from two files. A module that would write the
  barrel's own `index.ts` counts too.
- **UF7002** at `/outDir`: cleaning an `outDir/<target>` would delete the project, a source, or a file
  a source read.
- **UF7002** at `/srcDir`: a source imports a child the search didn't find, or a shared module above
  `srcDir`. No tree can hold it beside the source, so the import would break or the copy would leave
  `outDir/<target>`.

## Packaging

`build --package` also writes a publishable package to `<outDir>/package/` (plan §8.4, ADR-0077). It
replaces any earlier package once every packager has passed, so a failure keeps the last good one. A
`build` without the flag leaves that directory alone. Point `pnpm pack` or `npm publish` at it.

Its `package.json` takes `name`, `version` and `license` from the project's own, sets `"type": "module"`,
and adds:

- **`exports`:** one subpath per packaged target (`./react`, `./vue`, …), whose entry is that target's
  barrel, then `./source/*`, which reaches the `.uf.tsx` sources and the files under `srcDir` they
  read, and `./package.json`.
- **`peerDependencies`:** each packaged target's framework, every one optional in
  `peerDependenciesMeta`, so a React app installs no Vue.

A project with no `package.json`, or one with no `name` or `version`, exits 2 and writes nothing. So
does a source that reads a file above `srcDir`, like a sheet, since `./source/*` couldn't hold it.

`package.targets` limits which targets are packaged, and defaults to `targets`. Every target in
`targets` still gets its tree.

Each target's packager resolves from `package.resolveFrom`, which is one path or a path per target and
defaults to the project's root. It's never a dependency of the CLI. Each target ships like this:

- **Angular:** not packaged yet, so `--package` reports UF7008.
- **Astro:** the emitted sources, which Astro's compiler builds in the consumer's app. It needs no
  packager.
- **Qwik:** not packaged yet, so `--package` reports UF7008.
- **React:** tsdown builds JS and `.d.ts`, one module to a file, with each sheet beside its importer.
- **Solid:** the same through tsdown. A `solid` export condition points at preserved JSX, which a
  consumer's Solid compiler reads. Babel with `babel-preset-solid` compiles the plain JS for the DOM,
  so both must resolve beside tsdown.
- **Svelte:** not packaged yet, so `--package` reports UF7008.
- **Vue:** the SFC sources and `.ts` modules, with `vue-tsc`'s declarations beside them. Vue's compiler
  builds them in the consumer's app, and `vue-tsc` resolves its TypeScript from where it's installed.

A declaration's inferred types come from `@types/react`, `solid-js` or `vue`, so each must resolve from
where the package is built, the real path of `outDir`. Packaged outputs ship with no source maps.

`build --package` also reports:

- **UF7008:** a packager, or Solid's Babel, isn't installed, a target has no packager yet, or the
  framework's types don't resolve from `outDir`. Nothing is cleaned or written.
- **UF7009:** a packager failed, and its message holds the packager's own error. The targets' trees
  are written by then. tsgo under tsdown and `vue-tsc` write declarations without type-checking, so
  on them it's usually a syntax error, or a type a declaration can't name.
- **UF7002** at `/outDir`: cleaning `outDir/package` would delete the project, a source, or a file a
  source read.

## check

```sh
unframework check [--format pretty|json|sarif] [--type-oracle syntactic|tsgo]
```

`check` runs what `build` runs and writes no file, so it fails wherever `build`'s compile would. It
prints the diagnostics on standard output, a config's included, in the format asked for. A usage
error isn't a diagnostic, so it goes to standard error as plain text. The formats:

- `pretty`, the default: `formatDiagnostics`' code frames, and nothing when there are none.
- `json`: `toJsonDiagnostics`' array.
- `sarif`: `toSarif`'s log, version 2.1.0.

## explain

```sh
unframework explain UF1002
```

`explain` prints a code's catalogue entry, with its name, severity, title and description, and its
`docsUrl()`. An unknown code exits 2.

## init

```sh
unframework init [--force]
```

`init` starts a project in the working directory, and names each file it writes:

- **`unframework.config.ts`,** which names all seven targets, `src` and `dist`.
- **`src/Button.uf.tsx` and `src/Button.css`,** an example component and its stylesheet.
- **`tsconfig.uf.json`,** the scoped config from ADR-0073, for `tsc --noEmit -p tsconfig.uf.json`.
  `init` adds no dependency, so add `typescript` to the project to run this.
- **`AGENTS.md`,** which points agents at unframework.dev and names the commands that check and build.

It refuses to overwrite anything without `--force`: it exits 2, names every file in the way, says
what `--force` would do with each and writes nothing. A `unframework.config.mts`, `.js` or `.mjs`
counts as in the way, because the `.ts` file would replace it without a word.

With `--force`, `init` overwrites its own five files and leaves every other file alone. So such a
config stays on disk, the new `.ts` file wins and `init` says so on standard error. A symlink is
replaced, not written through. A directory where one of the five files should go exits 2 either way,
and so does a file named `src`.

`init` doesn't edit your own `tsconfig.json`. If you have one, add `**/*.uf.tsx` and `**/*.uf.ts` to
its `exclude`, so your framework's JSX types don't check these files (ADR-0073).

`check` exits 0 on the example, and prints UF4002 as an info for Angular and for Qwik, as it does for
any stylesheet.

The exception is a project whose `package.json` sets `"type": "commonjs"`, which `npm init -y` writes.
The example's config is an ES module, so there `check` and `build` exit 2 with UF7001. Set
`"type": "module"`, or rename the file `unframework.config.mts`. A `package.json` with no `type` works,
with a warning from Node.

`init` writes no test yet, because `@unframework/testing` stays private until M7.
