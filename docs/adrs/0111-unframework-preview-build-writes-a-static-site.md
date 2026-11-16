# ADR-0111: `unframework preview build` writes a static site

- **Status:** Accepted
- **Date:** 2026-11-17
- **Plan:** §8.6, §9 M7; ADR-0088, ADR-0104; amends ADR-0088

## Context

`unframework preview` (ADR-0088) runs one Vite dev server per target on `127.0.0.1`, and a shell
that frames them. Nothing can be deployed: a design system can't publish its preview for the people
who use it, or give each pull request a preview link, as Inkline's Storybooks did on Cloudflare
Workers.

The dev servers' configuration already does most of the work. `targetServerConfig` builds a
target's Vite config, from the target's `vite("browser")` fragment, the unframework plugin and the
project's own `vite`, without starting anything. The shell is one static page with its data and
script inlined. Three things stand in the way of a static site:

- **Origins.** Every frame has an origin of its own in development, and the shell builds each
  frame's URL from that origin.
- **Astro.** It has no client runtime. Its frame asks its own server to render, through
  `POST /__uf/render`, and a static host runs no server.
- **The builds.** No toolchain's browser fragment had been through `vite build`. It turned out
  that all seven build, with two catches. Qwik's plugin refuses a relative `base`
  (`config.base must begin and end with /`). React's mount adapter needs React's development
  build, since it renders inside `act`, which the production build doesn't have.

## Decision

- **`buildPreview({ root, targets?, out?, toolchainDirs? })`** in `@unframework.dev/visual`, beside
  `startPreview`, builds each target's frame with Vite's `build` on `targetServerConfig`'s config,
  into `<out>/<target>/`. The frame page is the build's input, written as
  `<out>/<target>/frame.html`, with its modules and sheets under `assets/`. The shell is written as
  `<out>/index.html`. It resolves to `{ out, targets }` once every target is built and every render
  server closed.
- **`unframework preview build [--target <t>]... [--out <dir>]`** runs it, prints the site's path
  and its targets, and exits 0. A usage error, an `--out` it refuses, a project with nothing to
  show, or a configuration or a build that fails exits 2. `--port` belongs to the served preview
  and `--out` to the build, and each refuses the other.
- **Relative URLs only.** The shell frames `./<target>/frame.html`, and every URL among a frame's
  files is relative. Vite's `base` is `/`, since Qwik refuses a relative one, and
  `experimental.renderBuiltUrl` gives every module, sheet and asset a URL relative to the file
  that names it. The preview's plugin then makes the frame page's own tags relative. So any static
  host serves the site at any path, with no rewrite and no server.
- **One origin for every frame.** In the static site every frame shares the shell's origin. The
  shell now gets each frame page's URL (`ShellData.frames` is `{ target, src }`), absolute in
  development and relative in the static site, and takes the frame's origin from it. The protocol
  is unchanged. Each side still checks the other's window, and the frame still checks the origin
  the shell gave it.
- **Astro is rendered at build time.** For a target that renders on the server
  (`renderCommandName`), the build starts a Vite server in middleware mode on the same config,
  which holds no port. Each entry is rendered with the props the shell first sends it: none for an
  example, and each required prop at its control's initial value for a component. The server and
  the toolchain are then closed. Each render is written as `<out>/astro/renders/<n>.json`,
  `{ props, html }`, or `{ props, error }` for a render that failed, which the frame shows as
  failed, as a dev server does. The frame module mounts the value each entry's module gives in
  the browser, a serialisable reference, and its render transport reads the entry's file in
  place of `POST /__uf/render`. A render with any other props fails in the frame with a message
  that says the static preview renders the target with each entry's initial props only.
- **Development builds.** The build uses `mode: "development"`, and `buildPreview` sets
  `NODE_ENV` to `development` while it builds, then restores it. The frames run what the dev
  servers serve, and React's adapter gets the `act` it needs.
- **No path of the build machine.** A development build names its sources by path, as React's
  `jsxDEV`, Vue's `__file` and Qwik's QRLs do. The preview's plugin makes every path under the root
  relative to it, and every other path under the root's repository relative to that. Source maps
  are off. A reference's id and a render's HTML are made relative the same way.
- **`--out`** defaults to `.unframework/preview` under the root, a dot directory that example
  discovery already skips. The build empties it first, so it refuses the root, a directory above
  it, and a directory that isn't empty and that no earlier build wrote, which it marks with
  `.unframework-preview`. That's how `unframework visual` treats its run directory.

## Consequences

**Positive:**

- A design system deploys its preview to any static host, Cloudflare Workers static assets with
  a preview link per pull request included, from one command.
- The site runs what the dev preview runs: the same Vite config per target, the same shell, the
  same protocol and the same mount adapters.
- Nothing in the build is specific to a host.

**Negative:**

- The static Astro frame shows each entry with its initial props only. A control change fails it,
  visibly. A server would be needed for more.
- The frames are development builds, bigger and slower than production ones, and they log a
  framework's development warnings.
- The frames share the shell's origin, so they share storage and cookies. An example that reads
  `localStorage` could see what another target's frame wrote.
- A path outside the root and its repository, like a package in a global store, stays absolute in
  a development build.

## Alternatives considered

- **A `"build"` mode in `Toolchain.vite`.** Every target builds from its `"browser"` fragment, so a
  third mode would add a contract for each of seven toolchains with no target that needs it.
- **Production builds.** React's adapter renders inside `act`, which React's production build
  lacks, so React's frame fails every render.
- **`base: "./"`.** Vite's own way to a relative site, but Qwik's plugin refuses it. A base for
  every target but Qwik would make one target's site differ from the others'.
- **A server for Astro in the deployed site,** like a Worker that renders. That ties the site to
  one host and runs code there, which a static preview avoids.
- **Rendering Astro with every value of every control.** The props a control can take are
  unbounded, like a string or a number, so the site would still miss most of them.
