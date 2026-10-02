# @unframework/target-astro

The Astro 7 target of the Unframework compiler: static `.astro` components with no client
runtime. Interactivity is declared unsupported, so event handlers are reported as inert.

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-astro/toolchain`**: for `ssr` projects, Astro's own Vite pipeline
  (`getViteConfig`, with the dev toolbar off), so virtual `.uf.tsx.astro` ids compile as real
  `.astro` files. For `browser` projects, no Astro plugins (in the browser they replace components
  with stubs that throw): a compiled component becomes a plain reference, and the `ufAstroRender`
  browser command renders it in Node, through a dedicated server built from the same pipeline,
  returning the HTML, the component's styles and what the render logged. L3 runs
  `@astrojs/compiler-rs` with Astro's options and reports every diagnostic (it refuses a compiler
  version other than the one `astro` uses); L4 runs `astro check` (`AstroCheck`, TypeScript 6)
  from the toolchain directory, once over every file.
- **`…/toolchain/client`**: inserts the server HTML into the container and moves the
  component's styles to `<head>`; nothing is hydrated, so there is nothing to settle.
- **`…/toolchain/server`**: renders with the Container API (`experimental_AstroContainer`).
