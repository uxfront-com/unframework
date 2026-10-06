# unframework

Write a component once, get native React, Vue, Svelte, Solid, Angular, Qwik and Astro. This package
is what a `.uf.tsx` file imports: the authoring API and the JSX types (plan §4, ADR-0006, ADR-0017).
The component below is plan §4.1's Counter, which the probes type-check as
[`probes/fixtures/Counter.uf.tsx`](probes/fixtures/Counter.uf.tsx).

```tsx
// Counter.uf.tsx
import { computed, defineEmits, ref } from "unframework";

import "./Counter.css";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export default function Counter({ initial = 0, step = 1 }: CounterProps) {
  const emit = defineEmits<{ change: [value: number] }>();

  const count = ref(initial);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value += step;
    emit("change", count.value);
  }

  return (
    <div class="counter">
      <output>{count.value}</output>
      {doubled.value > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        +{step}
      </button>
    </div>
  );
}
```

## Entry points

| Import                        | What it is                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unframework`                 | The authoring API of plan §4.2: `ref`, `computed`, `watch`, `watchEffect`, `onMounted`, `onUnmounted`, `nextTick`, `defineEmits`, `defineModel`, `defineSlots`, `defineExpose`, `defineOptions`, `useTemplateRef`, `useId`, `provide`, `inject`, and their types (`Ref`, `InjectionKey`, `JSX`, `Element`, …). |
| `unframework/jsx-runtime`     | The `JSX` namespace TypeScript reads for `"jsxImportSource": "unframework"`. Types only.                                                                                                                                                                                                                       |
| `unframework/jsx-dev-runtime` | The same types, for tools that pick the `react-jsxdev` transform.                                                                                                                                                                                                                                              |

The functions are inert stubs. The compiler recognises them by binding and erases them, so no
`unframework` import survives into any output. Calling one at runtime means the file was not compiled,
so each throws ``unframework: `ref` is compile-time only…`` rather than pretending to work.

The signatures are Vue 3.5's, narrowed to one canonical form each (ADR-0007): `defineModel` needs a
name, `defineEmits` takes a map of named tuples, `computed` takes a getter, `useTemplateRef` takes no
key, `provide` and `inject` take an `InjectionKey<T>`. A macro's type parameter defaults to `never`, so
an un-parameterised macro is unusable.

`JSX` is not a global, so it cannot collide with a host app's: write `import { type JSX } from
"unframework"`, or use the `Element` shorthand (`defineSlots<{ default?(): Element }>()`).

## Type-checking `.uf.tsx`

```jsonc
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "unframework",
    // tsc never emits a .uf.tsx (the compiler emits per target), and isolatedDeclarations would
    // demand an explicit return type on every exported component (TS9013).
    "declaration": false,
    "isolatedDeclarations": false,
  },
}
```

A stylesheet import (`import "./Counter.css"`) needs nothing more: `unframework/jsx-runtime` loads an
ambient `*.css` module, which TypeScript 7's `noUncheckedSideEffectImports` requires.

## What the types catch

Stock tsgo with these types is layer 1 of plan §5.6. Props are in the component's signature, so they
are checked for every consumer. Events, models and slots are declared by macros in the body, which
TypeScript cannot see: the types accept every legitimate use of them and leave their checking to the
compiler (layer 2) and the content mapper (layer 3, M5). Each row below is pinned by a probe in
[`probes/caught`](probes/caught), with the exact TypeScript error code.

| Where              | Caught                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elements           | Unknown attributes and tags; wrong value types (`disabled`, `tabindex`, `class`, declared `aria-*`), including through a spread; unknown CSS properties in `style`; unknown or non-function events and event options; the event object's type (`onClick` gets a `PointerEvent`, `onKeydown` a `KeyboardEvent`); children of void elements; `ref` of the wrong element type, or a string; `<component>` without `is`, or with an unknown tag; a slot object on an element; a list's `key` that is not a string or a number (ADR-0036).                                                                                                                                           |
| Props              | A default that does not fit its member's type (`({ size = 42 }: { size?: "sm" })`): the props are the component's signature (ADR-0034).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| React names        | `className`, `htmlFor`, `onKeyDown`, `onDoubleClick`. The compiler reports `className` and `htmlFor` too, as UF3004 (`non-canonical-attribute`) with a fix to `class` and `for`; until events land (M2) it rejects every event attribute, these included, as not supported yet (UF1002).                                                                                                                                                                                                                                                                                                                                                                                        |
| Components         | Wrong, misspelt or missing signature props, including literal unions; undeclared attributes other than `class` and `style` (`id`); a non-function or lowercase `on*` handler; a slot object mixed with other children; a slot function returning something that is not a child; a string `ref`; a component returning anything but JSX or `null`. An explicit `onX` prop keeps its declared payload type.                                                                                                                                                                                                                                                                       |
| Authoring API      | Unknown emit names, wrong or extra payloads, a payload that is not a tuple, using `emit`'s result; un-parameterised or call-signature `defineEmits`; `defineModel()` without a name, a wrong model value or default, a model without `default` or `required` read as always set; writing a computed, a writable computed; wrong slot props, undeclared slots; unknown or mistyped `defineOptions`; a non-object `defineExpose`; wrong `provide` values, string keys, an unchecked `inject`; a watched value of the wrong type, `previous` with `immediate`, watching a plain value; a keyed `useTemplateRef`, a template ref read without a null check; `JSX` used as a global. |
| Outside the subset | `reactive`, `toRefs`, a setup that returns a render function, `<component is>` over an open set of strings (plan §4.6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## What they deliberately do not catch

Each of these is pinned as clean code in [`probes/allowed/blind-spots.uf.tsx`](probes/allowed/blind-spots.uf.tsx)
(and [`framework-import.uf.tsx`](probes/allowed/framework-import.uf.tsx)), with the layer that catches
it. If a change starts catching one, the suite fails: move the probe to `caught/` and update both
tables.

The compiler's checks land with their features (plan §9). Props and static JSX (M1) have their own
codes (UF2001 to UF3025, most with a fix); the constructs of later milestones are rejected as not
supported yet (UF1002).

| Not caught by the types                                                                                                               | Caught by                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Event payload types on components                                                                                                     | the content mapper (layer 3), the type-checked outputs (layer 4)      |
| Unknown or misspelt events; children for a component without a default slot; undeclared slot keys                                     | the compiler (UF3xxx)                                                 |
| Model names and model types (`v-model:opne`, `v-model:open={42}`); slot-prop typos                                                    | the compiler (names), the content mapper (types)                      |
| Misspelt hyphenated names (`aria-hiddenn`, `v-modl`, `v-model_trimm`): TypeScript never checks an undeclared hyphenated JSX attribute | the compiler                                                          |
| `v-model` on an element without a value, or on a non-assignable expression                                                            | the compiler                                                          |
| Values outside the upstream's open string unions (`type`, `autocomplete`)                                                             | nothing, by design: the upstream declares them open                   |
| JSX outside the returned tree (in a variable, from a helper); early or conditional returns                                            | the compiler (plan §4.6)                                              |
| In-place mutation (`list.value.push(x)`, `form.value.name = x`)                                                                       | the compiler, with a fix (ADR-0008)                                   |
| A macro or reactive API inside a condition or a nested function                                                                       | the compiler (plan §4.6)                                              |
| Non-deterministic rendering (`Math.random()`, `toLocaleString()`)                                                                     | the compiler, UF3019 (plan §4.5)                                      |
| A number on a CSS length (`marginTop: 2`), a kebab-case style key, a boolean on a `data-*` attribute, SVG's `xlinkHref`               | the compiler (UF3018, UF3004), with a fix for the key and `xlinkHref` |
| `innerHTML`; `{true}`, a BigInt or an array as a child                                                                                | the compiler (UF1002, UF3016, UF3012)                                 |
| A list without a `key`, a `key` outside a list, a fragment as a list's item                                                           | the compiler (UF3013, UF3014, UF3015), with a fix for the first two   |
| `??` on a value that is never nullish; sorting a prop in place (`items.sort()`)                                                       | the compiler (UF3023, UF3021), with fixes                             |
| A conditional root (`return show ? <p /> : null`)                                                                                     | the compiler (UF1102), with a fix that wraps it in a fragment         |
| A stylesheet that is missing, owned by another component, or imported as a CSS module                                                 | the compiler (plan §4.4)                                              |
| An import from `react`, `vue` or another framework, when it is installed                                                              | the compiler (plan §4.6)                                              |

Undeclared global attributes on components (`<Counter id="x" />`) are an error for now; whether layer 1
should let them fall through is still open (spike 6).

## The vendored JSX types

The intrinsic elements come from `@vue/runtime-dom` (HTML attribute names, Vue's event names),
pinned exactly in `devDependencies`. [`src/vendor/vue-jsx.d.ts`](src/vendor/vue-jsx.d.ts) is a verbatim
copy of the JSX region of its `dist/runtime-dom.d.ts`, below a generated header that records the
version, the line range, two sha256 sums and the MIT notice. Only
[`src/jsx-upstream.ts`](src/jsx-upstream.ts), the owned alias, imports it: replacing the upstream is a
change to that one file. [`src/jsx-runtime.ts`](src/jsx-runtime.ts) adds what Vue's types lack: event
options, `children` typing, void elements, `v-model`, typed template refs, `<component is>`, and the
layer-1 component surface.

To move to a new upstream:

1. Bump the exact `@vue/runtime-dom` version and install.
2. `pnpm --filter unframework vendor:jsx`, and read the diff. The script refuses a version that is not
   pinned exactly, and an upstream whose JSX region changed shape.
3. `pnpm --filter unframework test`. The tests fail while the copy is stale, and the probes show
   exactly what the new types catch differently.

The repo's formatter and linter skip the vendored file (the root `oxfmt.config.ts` and
`oxlint.config.ts`), so the drift check can compare it byte for byte.

## The probes

[`probes/`](probes) is a type-checked tree with the authoring settings: `fixtures/` (components the
probes use), `caught/` (one `@ts-expect-error TSxxxx why` per mistake) and `allowed/` (legitimate
code and the blind spots, which must check clean). `pnpm --filter unframework test` runs
[`scripts/run-probes.ts`](scripts/run-probes.ts) over it in three steps:

1. **Layout:** every directive in `caught/` names its code, each file there pins at least one, and
   nothing else holds a directive or a `@ts-ignore`.
2. **Gate:** `tsc` exits 0. A mistake that stops being caught is an unused directive (TS2578); any
   error in `allowed/` or `fixtures/` is a false error.
3. **Pin:** a copy with every directive disabled must report exactly one error on each directive's
   next line, with the named code, and nothing on any other line. A directive hides every error on
   its line from the gate, so this is what catches a second error beside a pinned one.

The tests also run the suite against the built package, so the published types pin exactly what the
sources do. To check another TypeScript (a nightly, say): `pnpm --filter unframework probes
--tsc=<path to its tsc>`.

To add a probe, write the mistake in `caught/` under a directive with a guessed code, run the suite,
and correct the code from the report: the pin names the code TypeScript actually gives.
