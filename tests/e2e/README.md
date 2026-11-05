# End-to-end apps

This suite shows that what we publish works in a real app. Each app under `apps/` installs the workspace's packed tarballs outside the repository, as a user's project would, and Playwright drives it in Chromium. So an app runs on what a consumer would install, rather than on a workspace link. [ADR-0079](../../docs/adrs/0079-the-e2e-apps-and-packed-tarballs.md) records why.

## Run it

From the repository root, prepare the apps and then run the specs:

```sh
pnpm --filter @unframework/e2e prepare-apps
pnpm --filter @unframework/e2e e2e
pnpm --filter @unframework/e2e e2e -- --project 'vue:*'   # some projects only
```

Run `prepare-apps` again after you change a package or an app's files, because the specs run against the copies and not against `apps/`. A spec file under `e2e/` is the exception: Playwright reads it from `apps/`, so a change to one needs no new copy.

Outside CI, the root `pnpm install` also installs the Chromium that Playwright drives. The script is named `e2e`, not `test`, so the unit job skips it. The package's `test` script runs only the harness's own unit tests, in seconds.

## What `prepare-apps` does

It takes four steps:

1. It builds `unframework` and `@unframework/unplugin` with what they depend on, then runs the design system's `pack:dist` script if it has one.
2. It runs `pnpm pack` on them, on every workspace package they reach and on the design system, into `tests/e2e/.tarballs/`. The design system is packed from `design-system/dist/package` when that exists, and from its own directory otherwise.
3. It replaces each copy at `<work>/<app>`. `<work>` is `$UF_E2E_WORK_DIR`, or `unframework-e2e` in the system's temporary directory. The copy's manifest gains the design system's tarball, plus `unframework` and `@unframework/unplugin` if the app has a plugin mode. Its `pnpm-workspace.yaml` holds an override for every tarball and the `allowBuilds` list, which makes the copy its own workspace root.
4. It runs `pnpm install --prefer-offline` in the copy, and prints the copy's path.

`<work>` must be outside the repository: a copy inside it would resolve upward into the workspace's `node_modules`, so a dependency a tarball forgot would still pass. `prepare-apps` refuses such a directory. It also refuses to replace a directory it didn't make, which it recognises by the `.unframework-e2e-copy` file in each copy.

An install that stops with `ERR_PNPM_IGNORED_BUILDS` names a package that runs an install script. Add it to `ALLOWED_BUILDS` in `harness/apps.ts`.

## An app's layout

Each app keeps its files per mode, so that work on one mode leaves the other's files alone. Only `package.json` is shared:

| Path                                              | Holds                                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| `package.json`                                    | Exact versions from the `catalog:` and no path specifier  |
| `vite.config.package.ts`, `vite.config.plugin.ts` | Each mode's Vite config, whose `root` is its `src/<mode>` |
| `src/package/`, `src/plugin/`                     | Each mode's `index.html` and components                   |
| `e2e/package/`, `e2e/plugin/`                     | Each mode's specs                                         |

Each directory under `e2e/` is one Playwright project, named `<app>:<mode>`, so a new app or mode needs no change to `playwright.config.ts`. The `dev:package` and `dev:plugin` scripts start a mode by hand in a copy.

## Write a spec

Import `test` and `expect` from `harness/fixtures.ts`. Then `page.goto("/")` opens the project's dev server:

```ts
import { expect, test } from "../../../../harness/fixtures.ts";

test("hmr", async ({ page, edit }) => {
  await page.goto("/");
  await edit("src/package/Hello.tsx", "Hello from", "Goodbye from");
  await expect(page.getByRole("heading", { name: "Goodbye from React" })).toBeVisible();
});
```

The fixtures give you these:

| Fixture     | Scope  | What it does                                                                                                                               |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `devServer` | worker | Starts the copy's own Vite on a free port of `127.0.0.1`, through `createRequire`, and stops it in teardown. Its value is `url` and `copy` |
| `baseURL`   | test   | The dev server's `url`                                                                                                                     |
| `edit`      | test   | `edit(file, from, to)` changes a file in the copy, by its path from the copy's root, and restores it when the test ends                    |

`edit` rejects when the file doesn't contain `from`, since the test would otherwise wait for an update that never comes. It and the restore also wait until the dev server's watcher reports the write, and reject after 5 seconds if it never does, so the file must be one the server watches, like a file under the mode's `src/`. Without that wait, the next page could load before Vite has seen the write and keep the old content.

The run uses one worker and no retries. A project's specs share one copy and an HMR spec edits it, so nothing runs beside it. A flaky spec is a bug, so we never retry it.

## Servers and ports

Each dev server belongs to its Playwright worker and takes a free port, which it records in `<work>/.ports`. The global teardown then connects to every recorded port and fails the run if one still answers. On success it prints the ports it checked, so you can look them up with `lsof -iTCP -sTCP:LISTEN`. Test results go to `<work>/.results`, outside the repository.
