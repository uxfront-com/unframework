# Contributing to Unframework

This is the Unframework monorepo: a [Turborepo](https://turborepo.dev) on [pnpm](https://pnpm.io) workspaces, set up like [uxfront](https://github.com/uxfront-com/uxfront).

Found a bug, or have an idea? Search the [existing issues](https://github.com/uxfront-com/unframework/issues?q=is%3Aissue) first, then [open a new one](https://github.com/uxfront-com/unframework/issues/new/choose).

## Layout

- `apps/web`: the Nuxt site for [unframework.dev](https://unframework.dev). See [`apps/web/README.md`](../apps/web/README.md).
- `packages/*`: the packages of Unframework.

## Getting started

Node 24 or later. `packageManager` pins the pnpm version.

```sh
pnpm install
pnpm dev
```

## Scripts

| Command            | Does                                       |
| ------------------ | ------------------------------------------ |
| `pnpm build`       | Builds every workspace (`turbo run build`) |
| `pnpm dev`         | Runs every workspace's `dev` task          |
| `pnpm check-types` | Type-checks every workspace                |
| `pnpm test`        | Runs every workspace's tests               |
| `pnpm lint`        | Lints the repo with oxlint (type-aware)    |
| `pnpm format`      | Formats the repo with oxfmt                |
| `pnpm changeset`   | Records a change to a published package    |

## Shared parts from uxfront

The shared configuration comes from the published `@uxfront/*` packages, not from copies:

| Package                                                                                                 | Where                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`@uxfront/oxlint-config`](https://www.npmjs.com/package/@uxfront/oxlint-config)                        | `oxlint.config.ts` (the `/vue` preset)                   |
| [`@uxfront/oxfmt-config`](https://www.npmjs.com/package/@uxfront/oxfmt-config)                          | `oxfmt.config.ts`                                        |
| [`@uxfront/typescript-config`](https://www.npmjs.com/package/@uxfront/typescript-config)                | Each package's `tsconfig.json` (see below)               |
| [`@uxfront/layer-ui`](https://www.npmjs.com/package/@uxfront/layer-ui), `@uxfront/ui`, `@uxfront/scene` | The homepage in `apps/web`, the same look as uxfront.com |
| [`@uxfront/layer-docs`](https://www.npmjs.com/package/@uxfront/layer-docs)                              | The documentation site                                   |

## Adding a package

Create `packages/<name>/package.json` with `build`, `check-types` and `test` scripts as needed. turbo picks them up. Extend the shared TypeScript config:

```sh
pnpm --filter <name> add -D @uxfront/typescript-config typescript
```

```jsonc
// packages/<name>/tsconfig.json
{
  "extends": "@uxfront/typescript-config/tsconfig.json",
  "include": ["src", "test"],
}
```

For a published library, [`@uxfront/scene`](https://github.com/uxfront-com/uxfront/tree/main/packages/scene) is the model: `tsdown` builds `dist/`, `vitest` runs the tests, and `publishConfig.exports` points consumers at the build.

## Releases

Published packages are versioned and released with [Changesets](https://github.com/changesets/changesets). See [`.changeset/README.md`](../.changeset/README.md).
