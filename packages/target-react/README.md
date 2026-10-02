# @unframework/target-react

The React 19 target of the Unframework compiler: function components in TSX, with React's
prop names (`className`, `htmlFor`, `tabIndex`) and its rules for boolean props and form
controls. Static attributes React cannot render the way HTML would (a `style` string, an
`on*` handler string, `selected` on an `<option>`, `hidden="until-found"`) are reported as
UF1002 rather than emitted.

## Toolchain

The tests and tooling build, check and run React output through three entries:

- `@unframework/target-react/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`@vitejs/plugin-react`), the framework compile check (L3: React Compiler 1.0 on
  Babel 7, where a bailout is a warning) and the type check (L4: one TypeScript 7 run over
  all files, against `tests/toolchains/react/tsconfig.json`).
- `@unframework/target-react/toolchain/client` (browser): mounts with `createRoot` inside
  `act`.
- `@unframework/target-react/toolchain/server` (Node): renders with `prerender` and returns
  the component's HTML only.
