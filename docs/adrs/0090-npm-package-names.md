# ADR-0090: `@uxfront/unframework` plus `@unframework.dev/*`

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §11 D2, D12; §4.1, §5.2, §8.1, §8.3, §9 M6; P2; supersedes ADR-0016, and amends ADR-0006,
  ADR-0076, ADR-0079 and ADR-0080

## Context

ADR-0016 named the umbrella `unframework` and every other package `@unframework/<name>`. Neither
name can be published by this project:

- The unscoped `unframework` on npm is another author's package, released in 2016.
- The `@unframework` scope belongs to another npm user, who publishes packages of their own under
  it.

The project's owner holds the `@uxfront` scope and has created the `unframework.dev` organisation
on npm. The owner has also asked the author of `unframework` to transfer the name, so the
umbrella's name may change once more.

Every package is still private at `0.0.0`, so nothing published has to keep working.

## Decision

- **The umbrella is `@uxfront/unframework`,** with the subpaths ADR-0006 and ADR-0016 gave it:
  `/config`, `/jsx-runtime` and `/jsx-dev-runtime`. A component imports the authoring API from it,
  and `jsxImportSource` names it.
- **Every other package is `@unframework.dev/<name>`,** like `@unframework.dev/compiler` and
  `@unframework.dev/target-react`. The test workspaces under `tests/` take the same scope, though
  they are never published, so that a search for the old scope finds nothing.
- **These keep their names:** the `create-unframework` package, which is free on npm, so
  `npm create unframework` works, and the `unframework` bin and command. The bundler plugin is still
  named `unframework` in Vite and Astro, since Angular's ngtsc host finds it by that name.
- **The compiler holds the umbrella's name once.** `AUTHORING_PACKAGE` in
  `@unframework.dev/diagnostics` is what the analyser recognises (`isAuthoringModule`), what the
  catalogue's text and the analyser's messages quote and what `unframework init` writes.
  `create-unframework` keeps no dependencies (ADR-0076), so it holds its own copy, once. A later
  rename changes those two lines, the umbrella's manifest and the docs.
- **The old specifier gets no special case.** `import { ref } from "unframework"` is a package
  import like any other, so it's UF1002 (P2). A type import from it reaches the outputs as any
  package's type import does (ADR-0067).

```tsx
import { computed, defineEmits, ref } from "@uxfront/unframework";
```

```ts
import { defineConfig } from "@uxfront/unframework/config";
```

This amends four records, whose other points stand:

- **ADR-0006:** the authoring API and the JSX runtime come from `@uxfront/unframework`.
- **ADR-0076:** `defineConfig` is under `@uxfront/unframework/config`, and `create-unframework`
  writes a dependency on `@uxfront/unframework`.
- **ADR-0079:** the copies still override every packed package, because the packages depend on each
  other at `0.0.0`. The npm clash it also gave as a reason is gone.
- **ADR-0080:** `tsconfig.uf.json` sets `"jsxImportSource": "@uxfront/unframework"`.

## Consequences

**Positive:**

- Every package can be published under a name the project owns.
- The umbrella's name sits in one constant, its copy in `create-unframework` and the manifest, so
  the transfer of `unframework`, if it happens, is a small change.

**Negative:**

- The import in every component, and the JSX import source, now carry a scope.
- Two scopes to explain: `@uxfront` for the umbrella and `@unframework.dev` for the rest.
- A filter on the old names (`pnpm --filter unframework`) matches nothing and exits 0, so a script
  or a guide that still names one runs nothing and passes.

**Open:**

- Whether the umbrella moves back to `unframework`, once its author answers the owner's request.
- The first release under these names is the owner's decision.

## Alternatives considered

- **Keep the names and wait for the transfer.** Nothing could be published until it happens, and
  the `@unframework` scope would still not be ours.
- **Put every package under `@uxfront`.** The scope holds the UXFront homepage kit, so the
  compiler's packages would share it with unrelated ones.
- **Accept `unframework` as well as the new name.** It installs another author's package, so
  accepting it would hide a wrong install behind a compile that passes.
