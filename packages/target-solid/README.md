# @unframework/target-solid

The Solid 1.9 target of the Unframework compiler: function components in TSX with Solid's own
JSX, which keeps HTML attribute names.

## Toolchain

The tests and tooling build, check and run Solid output through three entries:

- `@unframework/target-solid/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`vite-plugin-solid`, with `ssr: true` for SSR and without solid-refresh), the
  framework compile check (L3: babel-preset-solid in `dom` and `ssr` modes, where a template a
  browser would parse differently is a warning) and the type check (L4: one TypeScript 7 run
  over all files, against `tests/toolchains/solid/tsconfig.json`).
- `@unframework/target-solid/toolchain/client` (browser): mounts with `render`.
- `@unframework/target-solid/toolchain/server` (Node): renders with `renderToStringAsync`.
