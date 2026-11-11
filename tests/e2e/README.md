# End-to-end apps

This suite shows that what we publish works in a real app. Each app under `apps/` installs the workspace's packed tarballs outside the repository, as a user's project would, and Playwright drives it in Chromium. So an app runs on what a consumer would install, rather than on a workspace link. [ADR-0079](../../docs/adrs/0079-the-e2e-apps-and-packed-tarballs.md) records why.

## Run it

From the repository root, prepare the apps and then run the specs:

```sh
pnpm --filter @unframework.dev/e2e prepare-apps
pnpm --filter @unframework.dev/e2e e2e
pnpm --filter @unframework.dev/e2e e2e -- --project 'vue:*'   # some projects only
```

Run `prepare-apps` again after you change a package or an app's files, because the specs run against the copies and not against `apps/`. A spec file under `e2e/` is the exception: Playwright reads it from `apps/`, so a change to one needs no new copy.

Outside CI, the root `pnpm install` also installs the Chromium that Playwright drives. The script is named `e2e`, not `test`, so the unit job skips it. The package's `test` script runs only the harness's own unit tests, in seconds.

## The design system's own tests

The design system tests its components the way a project would, with `unframework test`
([ADR-0086](../../docs/adrs/0086-a-projects-tests-with-define-test-config.md)). Each case is a
directory under `design-system/test/`: `button` and `card` hold a harness parent that fills the
component's slots, and `counter` and `text-field` point `case.json`'s `main` at the component in
`src/`. Run them from the repository root, and regenerate their expectations after a change that
should alter what they render:

```sh
pnpm --filter @unframework.dev/e2e-design-system parity
pnpm -C tests/e2e/design-system exec unframework test --update
```

The script is named `parity`, not `test`, so CI's unit job doesn't pick up its fourteen browser
and server render projects. Review every file `--update` writes under `__expected__/`.

## What `prepare-apps` does

It takes four steps:

1. It builds `@uxfront/unframework` and `@unframework.dev/unplugin` with what they depend on, then runs the design system's `pack:dist` script if it has one.
2. It runs `pnpm pack` on them, on every workspace package they reach and on the design system, into `tests/e2e/.tarballs/`. The design system is packed from `design-system/dist/package` when that exists, and from its own directory otherwise.
3. It replaces each copy at `<work>/<app>`. `<work>` is `$UF_E2E_WORK_DIR`, or `unframework-e2e` in the system's temporary directory. The copy's manifest gains the design system's tarball, plus `@uxfront/unframework` and `@unframework.dev/unplugin` if the app has a plugin mode. Its `pnpm-workspace.yaml` holds an override for every tarball and the `allowBuilds` list, which makes the copy its own workspace root.
4. It runs `pnpm install --prefer-offline` in the copy, and prints the copy's path.

Step 2 also writes `.tarballs/packed.json`, which names each package's tarball. Two flags split the steps, so the packages can be built once and installed elsewhere:

- `prepare-apps --pack` stops after step 2.
- `prepare-apps --reuse-tarballs` starts at step 3, with the tarballs that `packed.json` names. It fails if the record or a tarball is missing, and it never checks that they match your checkout, so pack again after you change a package.

CI's `Pack` job runs the first and uploads `.tarballs`. The `E2E` job downloads it, runs the second, then runs every project of every app in the Playwright image.

`<work>` must be outside the repository: a copy inside it would resolve upward into the workspace's `node_modules`, so a dependency a tarball forgot would still pass. `prepare-apps` refuses such a directory. It also refuses to replace a directory it didn't make, which it recognises by the `.unframework-e2e-copy` file in each copy.

An install that stops with `ERR_PNPM_IGNORED_BUILDS` names a package that runs an install script. Add it to `ALLOWED_BUILDS` in `harness/apps.ts`.

## An app's layout

Each app keeps its files per mode, so that work on one mode leaves the other's files alone. Only `package.json` is shared, and the TypeScript configs where an app has them:

| Path                                                  | Holds                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `package.json`                                        | Exact versions from the `catalog:` and no path specifier         |
| `vite.config.package.ts`, `vite.config.plugin.ts`     | Each mode's Vite config, whose `root` is its `src/<mode>`        |
| `astro.config.package.mjs`, `astro.config.plugin.mjs` | Astro's config for each mode, whose `srcDir` is its `src/<mode>` |
| `angular.json`, `tsconfig.json`                       | The Angular CLI's workspace, for the package mode                |
| `tsconfig.uf.json`                                    | The check of the app's own `.uf.tsx` files, for the plugin mode  |
| `src/package/`, `src/plugin/`                         | Each mode's entry and components                                 |
| `e2e/package/`, `e2e/plugin/`                         | Each mode's specs                                                |

Angular has the package mode only, because the Angular CLI has no plugin API. It's also the one app with TypeScript 6, since an Angular CLI app needs its compiler stack: [ADR-0079](../../docs/adrs/0079-the-e2e-apps-and-packed-tarballs.md) records the exception. Qwik's `tsconfig.json` also points Vite's dependency scan at Qwik's JSX runtime.

Both of Qwik's entries import `@qwik.dev/core/qwikloader.js`. A client-rendered Qwik element keeps its handlers for that loader, so without it a click does nothing.

In plugin mode, an app imports the design system's sources through its `./source/*` export and adds a `Greeting.uf.tsx` of its own, with a stylesheet and a `types.ts`, which its HMR spec edits. Its `tsconfig.uf.json` follows [ADR-0080](../../docs/adrs/0080-jsx-import-source-in-host-apps.md), and its `tsconfig.json` leaves the `.uf.tsx` and `.uf.ts` files out. Check them in the copy:

```sh
cd <work>/<app> && pnpm exec tsc --noEmit -p tsconfig.uf.json
```

Astro's `tsconfig.json` also leaves out `e2e/`, since the specs import the harness from the repository.

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

| Fixture     | Scope  | What it does                                                                                                                                      |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `devServer` | worker | Starts the copy's own dev server on a free port of `127.0.0.1`, and stops it in teardown. Its value is `url`, `copy`, `watcher` and `editTimeout` |
| `baseURL`   | test   | The dev server's `url`                                                                                                                            |
| `edit`      | test   | `edit(file, from, to)` changes a file in the copy, by its path from the copy's root, and restores it when the test ends                           |

Each app's server starts its own way, and that decides what `edit` waits for:

| App                             | Server                                                          | `edit` waits for                                    | Timeout |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- | ------- |
| React, Vue, Svelte, Solid, Qwik | Vite in the worker's process, loaded through `createRequire`    | Vite's watcher to report the write                  | 5s      |
| Astro                           | `dev()` in the worker's process, loaded through `createRequire` | The watcher on `dev()`'s result to report the write | 5s      |
| Angular                         | `ng serve`, spawned in its own process group                    | `rebuildWatcher`: the end of the next rebuild       | 20s     |

`edit` rejects when the file doesn't contain `from`, since the test would otherwise wait for an update that never comes. It and the restore also wait as the table says, and reject if the wait runs out, so the file must be one the server watches, like a file under the mode's `src/`. Without that wait, the next page could load before the server has seen the write and keep the old content.

An edit that changes nothing on the page, like a prop type in `types.ts`, shows only in the line Vite's client logs for each module it updates, `[vite] hot updated: <path>`. Wait for that line with `page.waitForEvent("console", …)`, set up before the edit. Make that edit first in the spec, because an earlier edit's update can log the same path after its own assertion passes.

`ng serve` runs in another process, so its watcher is out of reach, and a file event alone would come too early: until the rebuild ends, a page still loads the old bundle. `rebuildWatcher` reads the end of each rebuild from what `ng serve` prints, whether the rebuild failed, changed nothing or changed the bundle. Write one edit at a time there, because a file written during a rebuild is reported when that rebuild ends.

The smoke specs of the apps that render the design system share `harness/design-system.ts`, so every framework and mode is held to the same page: each component renders, the design system's sheet applies, and each component responds to one interaction. Astro renders on the server only, so its specs stop after the render. In package mode, `assertInstalledFromTarball` in `harness/apps.ts` runs first. pnpm always links `node_modules/<name>` into its virtual store, so it checks where that link leads and that the package holds no symbolic link.

Astro answers an edit that reaches the page with a full reload, so its plugin-mode HMR spec marks the page before each edit and expects the mark gone after it. A type changes nothing on the page, so for an edit to `types.ts` the reload is the evidence that the edit reached the page.

Qwik reloads a client-rendered page for every edit too. The unframework plugin sends that reload, because Qwik's own plugin sends its hot update only from the `ssr` environment ([ADR-0075](../../docs/adrs/0075-a-portable-bundler-plugin.md)). So Qwik's plugin-mode HMR spec counts the page's loads and expects one more after each edit.

The run uses one worker and no retries. A project's specs share one copy and an HMR spec edits it, so nothing runs beside it. A flaky spec is a bug, so we never retry it.

## Servers and ports

Each dev server belongs to its Playwright worker and takes a free port, which it records in `<work>/.ports`. A spawned `ng serve` gets a `SIGTERM` to its whole process group in teardown, and a `SIGKILL` 5 seconds later if it's still there, so esbuild's service goes with it.

The global teardown then connects to every recorded port and fails the run if one still answers. On success it prints the ports it checked, and `lsof -iTCP -sTCP:LISTEN` should show none of them. Test results go to `<work>/.results`, outside the repository.
