# ADR-0073: `jsxImportSource` in host apps is a scoped `tsconfig.uf.json`

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §4.1, §8.2, §9 M6; P3; ADR-0005, ADR-0006, ADR-0023, ADR-0072

## Context

A `.uf.tsx` file type-checks against `unframework`'s JSX types (ADR-0006). The `.tsx` files of a
host app type-check against their framework's, so one app holds two JSX worlds. A React app writes
`className`, and its `.uf.tsx` files write `class`.

Plan §8.2 leaves two ways to give `.uf.tsx` files their own `jsxImportSource`, a scoped tsconfig or
the per-file pragma, and says "M6 settles which". ADR-0005 and ADR-0006 repeat that. This record is
proposed before M6 builds it, and it's amended in place as it's built.

## Decision

- **A host app checks its `.uf.tsx` and `.uf.ts` files through a second config,
  `tsconfig.uf.json`.** Its `include` is `["**/*.uf.tsx", "**/*.uf.ts"]`, with
  `"jsx": "preserve"` and `"jsxImportSource": "unframework"`.
- **The host's root tsconfig excludes those files,** so they aren't roots of the host's program.
- **`unframework init` writes `tsconfig.uf.json`,** the example below as plain JSON, and it runs as
  `tsc --noEmit -p tsconfig.uf.json`. It leaves the host's root tsconfig as it is, so the host adds
  the `exclude` itself. It adds no dependency either, so the host adds `typescript`.
- **It excludes the build output.** `**/` never walks into `node_modules`, but it does walk into
  `dist`, where a package ships its `.uf.tsx` sources.
- **A `tsconfig.uf.json` that extends the root config sets its own `exclude`.** A config that sets
  no `exclude` inherits its base's, which then removes every file its `include` found (TS18003).

```jsonc
// tsconfig.uf.json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "jsx": "preserve",
    "jsxImportSource": "unframework",
  },
  "include": ["**/*.uf.tsx", "**/*.uf.ts"],
  "exclude": ["dist"],
}
```

```jsonc
// tsconfig.json, the host's own
{
  "exclude": ["**/*.uf.tsx", "**/*.uf.ts"],
}
```

## Consequences

**Positive:**

- A component's source stays free of tooling noise, and one setting serves every file. That keeps
  one canonical form (P3).
- A new `.uf.tsx` file is covered with no edit, because the `.uf` infix selects it (ADR-0005).
- The check reports a consumer's misuse of a child at its `.uf.tsx` line, as stock tsgo does in
  ADR-0023's probes.

**Negative:**

- A host runs two checks, `tsc` for its own files and `tsc -p tsconfig.uf.json` for these.
- `exclude` removes roots only. A host `.tsx` that imports a `.uf.tsx` brings it back into the
  host's program, under the host's JSX types, and the host's `tsc` then reports `class` as an error
  (Evidence).

**Open:**

- **How a host's own file types its import of a `.uf.tsx`.** Neither form settles it. Under the
  scoped config the host's `tsc` rejects `class` in the imported file. Under the pragma that file
  is clean, and the host's `tsc` rejects the component at the import's use, since `unframework`'s
  `Element` isn't a `ReactNode`. M6's plugin-mode apps check through the scoped config alone, so a later
  record has to settle this.

## Alternatives considered

- **The per-file pragma, `/** @jsxImportSource unframework */`.** It keeps every file in one
  program, under one config. But each component then carries a line that says nothing about the
  component, a forgotten pragma reports `class` as an error, and it's a second way to state what
  the `.uf` infix already says (P3). It also leaves a host's import failing (Open).
- **Setting `jsxImportSource` in the root tsconfig.** The host's own `.tsx` files would then lose
  their framework's JSX types.

## Evidence

A scratch project with tsgo 7.0.2 and `@types/react` 19.3.0 held `Greeting.uf.tsx`, which imports
`./Greeting.css` and a type from `./types.ts`, a `Parent.uf.tsx`, a `useToggle.uf.ts` and a React
`App.tsx`:

- **The example above:** `tsc -p tsconfig.uf.json` exits 0, with no declaration for the `.css`
  import. It leaves out a `.uf.tsx` planted in `dist` and one planted in `node_modules`.
- **A misuse:** `<Greeting name={1} />` in a `.uf.tsx` gives `TS2322: Type 'number' is not
assignable to type 'string'.` and exit 1.
- **The root config, with no host import:** `tsc -p tsconfig.json` exits 0.
- **An `extends` without its own `exclude`:** `TS18003: No inputs were found in config file`, with
  the same list as `include` and `exclude`.
- **A host import under the scoped config:** the root check exits 1 with `TS2322 … Property 'class'
does not exist on type 'DetailedHTMLProps<…>'. Did you mean 'className'?` at `Greeting.uf.tsx`.
  `tsc --listFilesOnly` lists the file despite `exclude`.
- **A host import under the pragma, in one config:** `Greeting.uf.tsx` is clean, and `App.tsx`
  gives `TS2786: 'Greeting' cannot be used as a JSX component.`
- **What `init` writes:** with `typescript` 7.0.2 linked in, `create-unframework`'s test runs
  `tsc --noEmit -p tsconfig.uf.json` on the scaffold, before and after `unframework build`, and it
  exits 0. `--listFilesOnly` names `src/Button.uf.tsx`, and a `<Button label={1} />` beside it fails
  the check.
