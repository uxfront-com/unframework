# ADR-0113: Preview controls reach an example's components

- **Status:** Accepted
- **Date:** 2026-11-19
- **Plan:** §8.6, §9 M7; ADR-0075, ADR-0087, ADR-0088, ADR-0111; amends ADR-0088

## Context

In `unframework preview` (ADR-0088), only a component entry gets controls. An example takes no
props (ADR-0087, UF7011), so the controls panel stays empty for it, and to see `ButtonColors`
disabled, or in another size, you write another example. Examples are where the useful content
is: a component entry renders with empty slots.

What a control should do on an example follows from what an example is. It renders components and
sets some of their props itself. A colors example sets each button's `color`, and leaves
`disabled` alone. A control for `disabled` should reach those buttons, and a control for `color`
must not undo what the example shows.

Three constraints shape how the values get in:

- **One behaviour on every target.** Whatever passes the values has to work on the seven targets
  and on `solid@2`, in dev and in `preview build`.
- **No runtime (P7).** An output imports only its framework, so a provider the components read
  from would change every component's output.
- **The preview's alone.** `unframework visual`, the tests and the corpus render an example as
  written, so its baselines can't move.

The frames already mount a component with props and update them in place on every target, and
"(default)" already leaves a component's optional prop out, so its own default applies.

## Decision

- **The preview rewrites an example's source for its own servers.** The example takes one optional
  prop per live control, `ufControl<n>`, under a parameter `ufPreview` (or `ufPreview<n>` when the
  source already uses that name). Each instance of the control's component that doesn't set the
  prop gets it bound right after its tag name: `<Button variant={ufPreview.ufControl0}>`. An
  instance that sets the prop, whatever its value, keeps it. The frames, the message protocol and
  the mount adapters don't change: a rewritten example is a component with props.
- **The rewrite adds no line break,** so every line keeps its number, and an error points at the
  right line. Columns move on the lines it touches.
- **Which components count.** An instance is a component node in the render of the example's
  default export whose import resolves to a component the preview lists: a default export of a
  `.uf.tsx` file under `srcDir`. A component the file declares itself, the instances inside it, a
  component from a package and an instance under `<component is>` are left alone. A `Dynamic`
  node's attributes must be declared by every candidate, so a candidate's prop can't be bound
  there.
- **The groups.** The catalogue reads each example once, at start, and gives it one group per
  component it renders that has a controllable prop, in the order of the component's first
  instance. A controllable prop that every instance sets is named "Set by the example". Every
  other one is a live control, optional, with a key numbered across the example, so two
  components' `tone`s get two keys. The panel names a field by its key and builds its id from it.
- **What the panel sends.** Every control at "(default)" sends no props, so the example renders as
  written, and Astro's static frame (ADR-0111) matches its build's render. Otherwise it sends every
  key, `undefined` at "(default)": Qwik follows only the props a component first rendered with
  (`late-prop`), and its mount adapter renders new props for an example that had none as a new
  instance, which then has every key.
- **An example the preview can't instrument is served as written:** one that declares props
  (UF7011), one that doesn't compile, and one that renders no component with a controllable
  prop. The panel says it has no controls, and the real compile reports the real error at its real
  span.
- **The plugin takes the rewrite.** `@unframework.dev/unplugin` gains `transformSource(file,
source)`, which gives the text to compile for a `.uf.tsx` or `.uf.ts` file, or `undefined` for
  the file as written. The plugin calls it on each read, on the first load and on a hot update
  alike, and compares what it returns, so a hot update compares like with like. The preview's
  servers, its static build and Astro's build-time renders pass it. Nothing else does.
- **Edits while the preview runs** go through the rewrite with the groups the preview started
  with. An instance an edit adds gets its component's controls. A component new to the example
  gets its controls after a restart, as a new example does. A control whose prop the child no
  longer declares is left unbound.

The sample design system's `Buttons` example, as each target's server compiles it:

```tsx
import Button from "../src/Button.uf.tsx";

export default function Buttons(ufPreview: { ufControl0?: "primary" | "secondary" }) {
  return (
    <div>
      <Button variant={ufPreview.ufControl0}>Save</Button>{" "}
      <Button variant="secondary">Cancel</Button>
    </div>
  );
}
```

## Consequences

**Positive:**

- An example shows the states its author didn't write out, on every target, with no new example.
- An example's own values hold, so a colors example still shows its colours.
- `unframework visual`, the tests and the corpus are untouched. With every control at "(default)",
  each frame's DOM equals the example as written, on all eight targets.

**Negative:**

- `@unframework.dev/unplugin` has a new public option, which a release makes a promise.
- The preview compiles each example once more at start, and once more on each load, to place the
  bindings.
- A compile error on a line the rewrite touched points at a shifted column.
- The controls an example gets are fixed when the preview starts, like the catalogue.

## Alternatives considered

- **A runtime provider the components read.** Every component's output would read it, which breaks
  P7 and changes what `unframework visual` renders.
- **A compiler plugin's `ir` hook.** It can't add code it didn't analyse (`plugin-ir.ts`), and the
  bindings are new expressions.
- **A rewritten copy on disk.** It writes beside the sources, which the preview never does, and the
  frames' module ids, the hot updates and the static build's paths would name the copy.
- **Binding every instance, the example's own values included.** It would undo what the example
  shows, which is the one thing the controls must not do.
