# Unframework

Write it once. Compile it to seven frameworks.

This is the Unframework monorepo: a [Turborepo](https://turborepo.dev) on [pnpm](https://pnpm.io) workspaces, set up like [uxfront](https://github.com/uxfront-com/uxfront).

## Layout

- `apps/*`: sites, such as the Nuxt site for [unframework.dev](https://unframework.dev).
- `packages/*`: the packages of Unframework.

## Shared parts from uxfront

The shared configuration comes from the published `@uxfront/*` packages, not from copies:

| Package                                                                                                 | Where                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`@uxfront/oxlint-config`](https://www.npmjs.com/package/@uxfront/oxlint-config)                        | `oxlint.config.ts` (`/vue` once there is a Vue app)      |
| [`@uxfront/oxfmt-config`](https://www.npmjs.com/package/@uxfront/oxfmt-config)                          | `oxfmt.config.ts`                                        |
| [`@uxfront/typescript-config`](https://www.npmjs.com/package/@uxfront/typescript-config)                | Each package's `tsconfig.json` (see below)               |
| [`@uxfront/layer-ui`](https://www.npmjs.com/package/@uxfront/layer-ui), `@uxfront/ui`, `@uxfront/scene` | The homepage in `apps/web`, the same look as uxfront.com |
| [`@uxfront/layer-docs`](https://www.npmjs.com/package/@uxfront/layer-docs)                              | The documentation site                                   |

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

Node 24 or later. `packageManager` pins the pnpm version.

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

Published packages are versioned and released with [Changesets](https://github.com/changesets/changesets). See [`.changeset/README.md`](.changeset/README.md).
