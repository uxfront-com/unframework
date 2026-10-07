# @unframework/target-astro

The Astro 7 target of the Unframework compiler: static `.astro` components with no client
runtime. Astro renders a component once, on the server, so the output is the component's initial
render: what the server render reaches of the setup, and the markup. It emits one `.astro` file
per component (ADR-0034, ADR-0046):

- **A frontmatter** at the very top when it declares anything (`src/frontmatter.ts`):
  - the type declarations the props and the kept setup reach (`liveTypes`), copied as written,
    and every one the source exports (exported then);
  - `Props`, which Astro types `Astro.props` and the component's callers by:
    `type Props = BadgeProps;` for a named props type, `interface Props { … }` holding an inline
    object type's members, nothing more when the props type is named `Props` already;
  - the props the server render reads (the markup and the kept setup), destructured in the
    source's order with their defaults: `const { label, tone = "info" } = Astro.props;`. Astro
    prints no list keys, so a prop only a key reads is left out, and so is a prop only client code
    reads, and the statement when nothing reads a prop. `Props` is exported
    (`export type Props = CardProps;`) when the frontmatter does not name `Astro` (no props read
    and no `useId` helper), as Astro's docs allow: nothing in the file reads it then, and
    astro-eslint-parser counts Astro's own read of `Props` only in a file that names `Astro`, so
    L5's unused-variable rule would report it. Callers are typed by it either way. It holds no
    event props: no listener runs on Astro;
  - the object form keeps its object, `const props = Astro.props;`, so its references stay as
    written. An object named `Astro` or `Fragment`, which the compiled component already
    declares, is declared as `props` and read as `props.x`;
  - the setup the server render reaches (`src/setup.ts`), in source order, through
    `liveBindings(component, { client: false, includeKeys: false })`:
    - a `ref` is a constant of its initial value, cast to the `ref`'s type, since a `const` keeps
      a literal's own type and narrows a union to its initial member (TS2367 in the markup's
      comparisons): `const count = 0 as number;`, `const status = "idle" as Status;`,
      `const picked = undefined as Item | undefined;` for `ref<Item>()`, and
      `(flag ? 1 : 2) as number` for a conditional of literals, which `ref` widens; any other
      value without a type argument is copied as it is (`const quantity = initial;`);
    - a `computed` is a constant of its value: `const total = quantity * price;`, cast like a
      `ref` for a type argument or a literal; a block getter is a local function called once,
      `function getTier(): Tier {…}` and `const tier = getTier();`;
    - `const`s and the local functions the server render calls are copied as written;
    - `useId()` calls the inline helper `uniqueId` (the `use-id` cell), a counter on
      `Astro.locals`, which lives for one request: ids are `uf-id-1`, `uf-id-2`… across the page,
      and every request starts again;
    - template refs, watchers, `watchEffect`, lifecycle hooks, setup `let`s, `defineEmits` and
      every function, state and type only they or a listener reach are left out: they never run.
      A setup binding named `Astro` is declared under a claimed name (`Astro_1`). The analyser
      rejects copied code with a line that is only `---` (UF1002), which would end the frontmatter
      for the linter and the formatter.
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
    root's outer edges with whitespace or starting with `---`, as a string expression;
  - a state's or a computed's `count.value` as the constant `count`; listeners and `ref={…}`
    print nothing (the dialect is inert), and a list's index only a handler reads is left out.

  A component whose frontmatter would declare nothing is its markup alone. Astro's
  `compressHTML` must stay `"jsx"`, its default (the M6 unplugin checks it).

The capabilities (`src/index.ts`): `interactivity`, `event-capture`, `event-once`,
`event-passive`, `event-semantics` and `next-tick` are unsupported (UF4001, for information):
components render on the server only and each render is a new instance, so handlers, template
refs, watchers and hooks never run and state keeps its initial value; the compiler reports only
`interactivity`, once per module. `use-id` is emulated (`uniqueId`). Every other capability is
native.

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
  as JSON. It takes no listeners (`on`): nothing emits. `rerender` is a new server render with
  the new props, whose HTML replaces the old and whose log it returns.
- **`…/toolchain/server`**: renders with the Container API (`experimental_AstroContainer`).

The emit tests lower real sources with the analyser's own source (`test/source.ts`); the
package's `turbo.json` hashes the analyser into this package's tests. `test/setup.test.ts` pins
M2's shapes (`M2_SHAPES` in `test/lint-probes.ts`, which `test/lint.test.ts` lints), renders them
through the Container API (two instances on a page for `useId`), and runs them through L3, L4 and
L5.
