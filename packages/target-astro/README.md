# @unframework/target-astro

The Astro 7 target of the Unframework compiler: static `.astro` components with no client
runtime. It emits one `.astro` file per component (design §5.7):

- **A frontmatter** at the very top when the component takes props (`src/frontmatter.ts`):
  - the type declarations the props reach, copied as written (exported when the source exports
    them);
  - `Props`, which Astro types `Astro.props` and the component's callers by:
    `type Props = BadgeProps;` for a named props type, `interface Props { … }` holding an inline
    object type's members, nothing more when the props type is named `Props` already;
  - the props the markup reads, destructured in the source's order with their defaults:
    `const { label, tone = "info" } = Astro.props;`. Astro prints no list keys, so a prop only a
    key reads is left out, and so is the statement when the markup reads no prop. `Props` is then
    exported (`export type Props = CardProps;`), as Astro's docs allow: nothing in the file reads
    it, and astro-eslint-parser counts Astro's own read of `Props` only in a file that names
    `Astro`, so L5's unused-variable rule would report it. Callers are typed by it either way;
  - the object form keeps its object, `const props = Astro.props;`, so its references stay as
    written. An object named `Astro` or `Fragment`, which the compiled component already
    declares, is declared as `props` and read as `props.x`.
- **The markup**, printed by the Astro markup dialect (`@unframework/codegen`'s `astroDialect`,
  owned with this target), whose expressions are printed as written:
  - `{expr}` interpolations, and `name={expr}` bindings;
  - conditionals as ternary chains ending in `null`, never `&&`, which renders a falsy left side
    (`0`); a branch of several nodes is a fragment;
  - lists as `{source.map((item, index) => (…))}` without `key`, which Astro would render as an
    attribute; a parameter the body does not read is left out;
  - `class:list={[…]}` for a class with any binding in it, a spread's `class` key included, and
    a static `class` otherwise; a style object with camel-case keys and quoted custom properties
    for a style with a binding, a static `style` otherwise;
  - a spread written out as one attribute per declared key, read through `?.` when the object
    may be absent;
  - a bound `multiple`, which Astro's renderer does not read as a boolean, as
    `multiple={c ? "" : undefined}`;
  - `autocorrect`, which Astro's JSX types declare on form controls only, elsewhere as an object
    spread, `{...{ autocorrect: "off" }}`, which renders the same and passes `astro check`
    (`src/markup.ts`, pinned against `astro check` by `test/attributes.test.ts`);
  - text with `{`, `}`, `<` and `>` as references; text holding a line break or a tab, or at the
    root's outer edges with whitespace or starting with `---`, as a string expression.

  A component without props is its markup alone. Astro's `compressHTML` must stay `"jsx"`, its
  default (the M6 unplugin checks it). Interactivity is declared unsupported (UF4001): event
  handlers are inert. Every other capability is native.

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-astro/toolchain`**: for `ssr` projects, Astro's own Vite pipeline
  (`getViteConfig`, with the dev toolbar off), so virtual `.uf.tsx.astro` ids compile as real
  `.astro` files. For `browser` projects, no Astro plugins (in the browser they replace components
  with stubs that throw): a compiled component becomes a plain reference, and the `ufAstroRender`
  browser command renders it in Node, through a dedicated server built from the same pipeline,
  returning the HTML, the component's styles and what the render logged. The checks:
  - L3 runs `@astrojs/compiler-rs` with Astro's options and reports every diagnostic (it refuses
    a compiler version other than the one `astro` uses);
  - L4 runs `astro check` (`AstroCheck`, TypeScript 6) from the toolchain directory, once over
    every file;
  - L5 (ADR-0042) runs oxlint's shared baseline over the frontmatter and ESLint with
    eslint-plugin-astro over the whole file.
- **`…/toolchain/client`**: inserts the server HTML into the container and moves the
  component's styles to `<head>`; nothing is hydrated, so there is nothing to settle. Props travel
  as JSON. `rerender` is a new server render with the new props, whose HTML replaces the old and
  whose log it returns.
- **`…/toolchain/server`**: renders with the Container API (`experimental_AstroContainer`).

The emit tests lower real sources with the analyser's own source (`test/source.ts`); the
package's `turbo.json` hashes the analyser into this package's tests.
