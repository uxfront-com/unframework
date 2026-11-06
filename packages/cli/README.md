# @unframework/cli

The `unframework` command line (plan §8.3, ADR-0076). The `unframework` package's bin runs it, so a
project runs it as `unframework <command>`, from the directory that holds its
`unframework.config.ts`. A project with no config takes the defaults.

| Exit code | Meaning                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| 0         | Success, warnings and notes included, but for what `strict` makes an error.         |
| 1         | Error diagnostics, in a source or because no source was found.                      |
| 2         | A usage error, a config that won't load or is invalid, or a failure writing a file. |

`main(argv, io?)` runs a command line, `argv` without Node and the script, and gives the exit code.
It never throws. `io` holds the working directory and where text goes, and defaults to the process's.

## build

```sh
unframework build [--type-oracle syntactic|tsgo]
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

A successful build prints only its warnings and notes, on standard error. A build with an error diagnostic, or with a config it refuses, cleans and writes nothing, so the last
good build stays in place. A failure while writing does exit 2 with the build half written.

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
