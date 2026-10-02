# @unframework/target-qwik

The Qwik 2 target of the Unframework compiler (experimental while Qwik 2 is in beta):
`component$` components in TSX.

```tsx
import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return <p class="greeting">Hello, world!</p>;
});
```

- The export shape follows the source: a default export, a same-named `export const`, or an
  export list for aliases and several exports of one component.
- Attributes on HTML elements take the spelling Qwik's JSX types declare (`tabindex` →
  `tabIndex`, `readonly` → `readOnly`); SVG and MathML keep their case-sensitive names. An
  attribute written without a value stays bare when it is one of HTML's boolean attributes and
  becomes `=""` otherwise, because Qwik's client renderer writes `true` as `"true"`.

## Toolchain

Tests and tooling use three Node and browser entries (plan §5.7, `Toolchain` in
`@unframework/codegen`):

| Entry                                       | What it is                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@unframework/target-qwik/toolchain`        | `toolchain`: the Vite configuration of `browser` and `ssr` projects (`qwikVite` with `srcDir` at the project root, `csr` in the browser, no app entry, HMR, the image dev tool and the inspector off), L3 and L4. |
| `@unframework/target-qwik/toolchain/client` | `mount`: a client-only `render(container, jsx(Component, props))` with the qwikloader, settled with Qwik's render promise. Every mount needs a fresh container.                                                   |
| `@unframework/target-qwik/toolchain/server` | `renderToString`: `renderToString` from `@qwik.dev/core/server` into a fragment container, returning only the component's HTML.                                                                                   |

- **L3** runs the Rust optimizer from `@qwik.dev/optimizer` (the exact version
  `@qwik.dev/core` depends on, checked at start) over each file, for the client and the
  server, with the `segment` entry strategy.
- **L4** runs TypeScript 7 (tsgo) once over every file, through a temporary tsconfig in
  `<toolchainDir>/.uf-tmp/` that extends `<toolchainDir>/tsconfig.json`. In this repo the
  toolchain directory is `tests/toolchains/qwik`.

Both reject when they cannot start. The browser adapter relies on Qwik internals
(`_getDomContainer`, `_waitUntilRendered`) until Qwik 2 has a public way to wait for a render.
