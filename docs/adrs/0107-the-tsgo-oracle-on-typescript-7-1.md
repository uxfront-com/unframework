# ADR-0107: The tsgo oracle on TypeScript 7.1

- **Status:** Accepted
- **Date:** 2026-11-15
- **Plan:** §5.5, §9 M5, Appendix C; P2, P8; ADR-0022, ADR-0067; amends ADR-0067

## Context

ADR-0067 puts the tsgo adapter, `@unframework.dev/type-oracle-tsgo`, on `typescript/unstable/sync`,
pinned exactly at 7.0.2, and leaves its port to the 7.1 API open. The repository now moves its
TypeScript 7 pin to `7.1.0-beta`, and the adapter is the only package that loads TypeScript's API,
so it moves too. The beta changes that API in ways the adapter can't ignore:

- **The paths moved.** `typescript/unstable/{ast,ast/is,sync}` are gone. The same modules are
  `typescript/{ast,ast/is,sync}`, beside a new `typescript/fs`.
- **Snapshots work differently.** `API#updateSnapshot` is private. `API#createSnapshot` makes the
  first one, and `Snapshot#update` makes the next. A notified file change only marks a project
  dirty: its program is rebuilt only for the projects `ensurePrograms` names.
- **Projects take an id.** `Snapshot#getProject` takes a `ProjectId`, and
  `Snapshot#getConfiguredProject` takes the tsconfig's file name.
- **The `fs` callbacks are total.** Each of the eight is required, and an operation falls back to
  the disk through the `serverFS.useOS` sentinel instead of `undefined`.
- **Tuples read through their target.** A tuple's `elementFlags` and `readonly` are on the
  `TupleType` that `TupleTypeReference#getTarget()` returns.
- **`CheckFlags` is exported, and renumbered.** `Mapped` is `1 << 21`, where 7.0's was the
  `1 << 18` the adapter copied by hand. On 7.1, `1 << 18` is `RestParameter`, so a copied constant
  would give wrong shapes for mapped members, silently (P2).

The stable 7.1.0 is planned for 24 November 2026.

## Decision

- **The adapter runs on TypeScript 7.1.** It imports `typescript/sync`, `typescript/ast`,
  `typescript/ast/is` and `typescript/fs`, pinned exactly at `7.1.0-beta` by the catalog until
  7.1.0 is published, then at `7.1.0`.
- **It serves only its tsconfig from memory.** Every other path and operation is
  `serverFS.useOS`, so the checker reads the disk as it did on 7.0.
- **An update rebuilds the oracle's own project.** `update` notifies the changed, created and
  deleted files and names the project in `ensurePrograms`. A snapshot `update` gives back unchanged
  is kept, not disposed.
- **It reads the checker's flags from TypeScript.** `CheckFlags` comes from `typescript/sync`, never
  a copied number.
- `TypeOracle`, `TypeShape` and the contract suite don't change, and both adapters still pass the
  suite. Everything else in ADR-0067 holds.

## Consequences

**Positive:**

- The adapter is on the API TypeScript plans to keep stable from 7.1.
- A renumbered flag can't silently change a shape again.

**Negative:**

- Until 7.1.0 ships, the published adapter depends on a beta, and so does every install of
  `@uxfront/unframework`, through the CLI. A user who doesn't declare `typescript` can get the beta
  hoisted to the top of `node_modules`.
- If 7.1.0 changes the API again, the adapter changes with it.

**Open:**

- The move from `7.1.0-beta` to `7.1.0` once it's published, in its own release.

## Alternatives considered

- **Stay on 7.0.2 for the adapter alone.** The catalog has one `typescript` for the whole
  repository (Appendix C), and the adapter's tests and the rest of the gate would then run on two
  TypeScript 7 versions.
- **Wait for 7.1.0.** It keeps a beta out of the published packages for about nine days, but leaves
  the repository on 7.0.2 until then. The owner chose to move now and release as usual.
