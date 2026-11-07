# @unframework/visual

The Storybook preset and story generator of the visual harness. Each target gets one catalogue, compiled through the unplugin (ADR-0021) and rendered with the target's mount adapter, on `@storybook/html-vite`, with no native framework Storybook package.

Private until M7. `tests/integration/README.md` has the commands that build and open a catalogue.

## The generator

`generateStories(directory, stories)` takes a list of `{ id, title, source, args }` and returns one stories file per title, so each case is a lazy chunk. `args` is JavaScript source, so a prop can hold `undefined`. A story with `noOutput` shows that reason as text and imports no component.

`generateRunner(directory, { target, specs })` returns the hidden `uf-runner--spec` story: it renders nothing, stays out of the list, and sets `globalThis.__ufRunSpec`, which loads the page host and one spec. A page that browses the catalogue loads neither.

## The preset

`@unframework/visual/preset` exports `createStorybookConfig(options)`, the main configuration each `.storybook/main.ts` shares. It takes the target, the Vite root, the stories' glob, the cases' main modules, the unplugin's options, the plugins that run before the unplugin and the toolchain's Vite configuration. The build runs in development mode, unminified, with `vitest` and `vitest/browser` resolved to the page host. `@unframework/testing` needs no alias, since it reaches its runner through the host port.

Every build writes `uf-build-manifest.json` to its output directory, with each main module's events. Its `failures` list stays empty for now, since a build can't isolate a failure yet. `@unframework/testing/node` reads and writes the file.

## The preview

`@unframework/visual/preview` exports `createPreview(mount)`, which each `.storybook/preview.ts` calls with its target's adapter. Its `renderToCanvas` mounts a story's component with its args, and rerenders it when the args update. It adds no decorators, and sets `layout: "fullscreen"`.
