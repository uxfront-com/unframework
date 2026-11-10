# create-unframework

`create-unframework` starts a new Unframework project in a directory you name. It writes the
project's `package.json`, then scaffolds the rest with the `unframework` installed there.

```sh
create-unframework my-components
```

It creates the directory if it has to, and writes a private `package.json` with `unframework` as a
dependency. Then it runs that project's own `unframework init`, which writes the config, an example
component, `tsconfig.uf.json` and `AGENTS.md`. The [`init` section of the CLI's README](../cli/README.md#init)
lists them.

`create-unframework` has no dependencies and installs nothing. So unless the directory already has
`unframework` in its `node_modules`, it stops after the `package.json`, and tells you to install the
dependencies and run `unframework init` there yourself. Keep in mind that nothing is published yet,
and the name `unframework` on npm belongs to a third party until a release settles it (ADR-0076), so
an install from the registry won't give you this compiler. The `package.json` lists only
`unframework`, so add `typescript` to run `tsc --noEmit -p tsconfig.uf.json`.

| Exit code | Meaning                                                                              |
| --------- | ------------------------------------------------------------------------------------ |
| 0         | The project is created.                                                              |
| 1         | The `package.json` is written, and `unframework` isn't installed in the project yet. |
| 2         | A usage error, a `package.json` already there, a failure or `init`'s own refusal.    |

Once `init` runs, the exit code is its own, so a crash in it exits 1 as well, with its error above.
A bin killed by a signal exits 2.

An existing `package.json` is never overwritten. When `init` refuses because one of its files is in
the way, the `package.json` stays written, so run `unframework init --force` in the directory if you
want to replace that file. Note that `--force` leaves a `unframework.config.mts`, `.js` or `.mjs` in
place, and the new `unframework.config.ts` takes precedence over it.

`main(argv, io?)` runs a command line, `argv` without Node and the script, and gives the exit code. It
never throws. `io` holds the working directory and where text goes, and defaults to the process's.
