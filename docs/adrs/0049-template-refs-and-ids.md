# ADR-0049: A template ref holds one element in client code, and every id starts `uf-id-`

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §4.2 (Template refs, IDs), §4.5, §6, §7.5, §9 M2; P2, P4, P6, P7; R5, R6; ADR-0015,
  ADR-0031, ADR-0045, ADR-0048; amends ADR-0031 and ADR-0034

## Context

Plan §4.2 gives the source `const input = useTemplateRef<HTMLInputElement>()` with
`<input ref={input} />`, its one deliberate departure from Vue's signature (JSX passes the ref
object, so there is no string key), and `const id = useId()`, "stable under SSR on every target".
ADR-0031 already decided how an id compares: only an id that starts `uf-id-` is canonicalised, and
M2's `useId` must prepend that prefix to the framework's own id on every target.

Probes found where the frameworks' refs and ids part:

- **An empty ref differs.** Vue's and React's are `null`; Svelte's `bind:this` and Solid's `ref`
  give `undefined` until the element is there, and Angular's `viewChild` gives `undefined`. Vue
  fills a ref attached inside `v-for` with an array, the others with the last element. Qwik sets a
  ref signal when the element is created and never clears it. The source types a template ref's
  value `T | null`, as Vue and React hold it, so a source that keeps the element in a `let` typed
  `T | null` failed L4 on Svelte, Solid, Angular and Qwik.
- **Refs are set at different times.** Vue sets a template ref in a post-flush job, so `onMounted`
  and `await nextTick()` see it; Solid's `ref={el}` assigns a `let` its compiler writes, which
  oxlint's `no-unassigned-vars` rejects; Svelte wants `$state` for a `bind:this` inside `{#if}`;
  Vue empties a ref before `onUnmounted` runs, and React before an effect's cleanup.
- **Each framework patches what its template binds its own way.** Angular keeps a class it did not
  add, Qwik writes the whole `style` attribute again, and every framework renders an element's
  structure and text from state.
- **Ids have no common API.** React, Vue, Solid and Qwik have one; Svelte's `$props.id()` may be
  called once per component, as a declaration of its own; Angular and Astro have none. Qwik's lint
  rule `qwik/use-method-usage` refuses a `use…` call inside a template literal.

## Decision

- **A template ref is attached by one element, outside lists** (UF3027, `invalid-template-ref`):
  `ref={field}` names a template ref (a string as Vue writes it, a callback, a member or another
  binding is UF3027); each template ref is attached exactly once (a second attachment is UF3027,
  with the first as related information, and so is one never attached); and never inside a list. An
  element inside a conditional is fine: the ref is empty while the branch does not render. `REF` or
  `Ref` is UF3004, with a safe rename to `ref`. Angular's literal region (an element whose static
  attribute holds `{{`) binds nothing, so a `ref` there is UF1002, as a binding is (ADR-0037). The
  IR records a `RefAttribute { binding }`, which renders nothing, and the invariants check every
  rule (ADR-0032).
- **It holds an element in client code only.** A template ref is empty before mount, set before
  `onMounted` runs, and empty again once its element is removed. It is read only in client code,
  never as a dependency: a read in render, pure code, a watch source or while a `watchEffect` runs
  is UF2010 (`non-reactive-read`); one in what a `watchEffect` hands on to run later (a frame's
  callback) is accepted (ADR-0048). A watcher that reads it needs `flush: "post"` (UF2018). Teardown
  code reads none (UF2026, ADR-0048): read the element in the callback that sets up the work, and
  keep it in a local or a setup `let`. A ref alone makes `interactivity` required.
- **Its value is `T | null` on every target**, `null` while the element is not there, as the
  source types it: a read the source keeps, passes, returns or compares strictly type-checks and
  behaves as the source's, and `field.value === null` holds when the ref is empty on every target.
  A read that a condition shows present (`if (field.value) field.value.focus()`) is marked narrowed
  (ADR-0046), and the targets that read through a call assert it.
- **Client code never rebuilds a rendered element by hand** (UF3028, `template-ref-use`). Every
  framework renders its elements from state, so client code does not change a rendered element's
  structure or text (`textContent`, `innerHTML`, `append`, `remove`, `insertBefore`, …, as
  eslint-plugin-svelte's `no-dom-manipulating` lists them). Nor does it change the classes of an
  element whose `class` the template binds (`classList.add()`, `className`,
  `setAttribute("class", …)`), or the style of one whose `style` the template binds
  (`style.color`, `style.setProperty()`). A class, a style or an attribute the template does not
  bind is the code's own on every target (an autosizing textarea's `style.height`,
  `setAttribute("aria-busy", …)`, `dataset.x`), as is any attribute: each target compares a bound
  attribute with the value it last wrote. A rendered element is a template ref's, the event's
  `currentTarget` and `target`, and any node reached from one (`parentElement`, `querySelector(…)`,
  the items of `querySelectorAll(…)` and `children`, in a loop or an array method's callback),
  itself or through a local (ADR-0045's provenance). An element of a template ref is judged by the
  elements the ref is attached to; a listener's `event.currentTarget` by the elements whose
  listeners run it, and its `event.target` by those and what they hold; any other by every element
  of the template. Other properties and methods (`focus()`, `select()`, `scrollIntoView()`,
  `showModal()`, `childElementCount`, an input's `value`) are fine, and so is the document's own
  `<body>`. Any test of an empty ref is fine, strict or loose.
- **Form state stays M3's.** A bound `value` on an `<input>` remains UF1002 until `v-model`
  (ADR-0037). An uncontrolled field that `onInput` reads into state, and that a component clears
  through a template ref in client code, is the M2 form (`events/inline-handlers`, `events/keys`,
  `semantics/prevent-default`); UF2004 accepts the change of a template ref's element.
- **Each target lowers a template ref its own way:**

  | Target  | Declaration                                               | Attached            | Read in client code                                           |
  | ------- | --------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
  | React   | `const field = useRef<HTMLInputElement>(null)`            | `ref={field}`       | `field.current`                                               |
  | Vue     | `const field = useTemplateRef<HTMLInputElement>("field")` | `ref="field"`       | `field.value`                                                 |
  | Svelte  | `let field: HTMLInputElement \| null = null`              | `bind:this={field}` | `field`                                                       |
  | Solid   | `let field: HTMLInputElement \| null = null`              | a `ref` callback    | `field`                                                       |
  | Angular | `viewChild<ElementRef<HTMLInputElement>>("field")`        | `#field`            | `this.field()?.nativeElement`, `?? null` when used whole      |
  | Qwik    | `const field = useSignal<HTMLInputElement>()`             | `ref={field}`       | `field.value`, `field.value ?? null`, `rendered(field.value)` |
  | Astro   | nothing                                                   | nothing             | nothing                                                       |

  The targets' details:

  - **Vue** keys `useTemplateRef` by the binding's own name, beside an element `ref` of the same
    name: runtime-core never writes a setup binding that `useTemplateRef` returned, and sets the
    element through the key.
  - **React** types an unannotated ref with its element's interface, as the authoring types'
    `DomElementFor` reads it (`useRef<HTMLInputElement>`, `useRef<SVGCircleElement>`). A ref
    annotated otherwise than its element's interface (`useTemplateRef<HTMLElement>()` on a
    `<div>`) is set by a callback, `ref={(element) => { panel.current = element; }}`, since React
    19's `RefObject` is checked against the element's type. Where the element also listens
    natively (ADR-0047), its ref callback sets and clears the ref.
  - **Svelte** declares a plain `let field: T | null = null`, as its documentation binds an element,
    since no code tracks a ref; inside an `{#if}`, `{#each}`, `{#await}` or `{#key}` it is
    `$state<T | null>(null)`, as Svelte's `non_reactive_update` asks; an untyped one is `unknown`.
    `bind_this` writes `null` in the teardown of the element's effect, so the value is `null` before
    mount and after removal, as on Vue and React.
  - **Solid** sets a plain `let` from the element's `ref` callback, which empties it in `onCleanup`
    when the element's branch is disposed:
    `ref={(element) => { field = element; onCleanup(() => { field = null; }); }}`.
  - **Angular** writes `viewChild` with the element's `#name`, and drops the `?.` after
    `?.nativeElement`, as an `ElementRef`'s element is never nullish. A read the source uses whole
    ends in `?? null`; one that only tests it, asserts it or reads through it needs none; a
    narrowed read is `this.field()!.nativeElement`. A template ref named like an event takes another
    member name, `fieldElement` (ADR-0047).
  - **Qwik** reads a ref the source uses whole as `field.value ?? null`, and a ref whose element is
    inside a conditional through `rendered()`, an inline helper typed `T | null` that gives the
    element while it is connected and `null` once it is not.

- **`useId()` is `"uf-id-"` and the framework's id, on every target** (ADR-0031's prefix rule,
  confirmed). It is an `Id` item that binds a `localConst` of kind `string`:

  | Target  | Lowering                                                                                | `use-id`             |
  | ------- | --------------------------------------------------------------------------------------- | -------------------- |
  | React   | ``const inputId = `uf-id-${useId()}`;``                                                 | native               |
  | Vue     | ``const inputId = `uf-id-${useId()}`;``                                                 | native               |
  | Svelte  | `const uid = $props.id();` once, then `` `uf-id-${uid}-0` ``, `` `uf-id-${uid}-1` ``, … | native               |
  | Solid   | ``const inputId = `uf-id-${createUniqueId()}`;``                                        | native               |
  | Angular | `` `uf-id-email-field-${nextId++}` `` from a module `let nextId = 0;`                   | emulated, `nextId`   |
  | Qwik    | `const inputId = "uf-id-" + useId();`                                                   | native               |
  | Astro   | `const inputId = uniqueId();`, a counter on `Astro.locals`                              | emulated, `uniqueId` |

  Every Svelte id has a suffix of its own, the first one's included, so `${id}-${n}` of one id never
  spells another. Angular's counter carries the component's name in kebab case, as Angular
  Material makes its ids, so two components' counters never meet. Astro's helper counts on
  `Astro.locals`, which lives for one request and is shared by every component it renders: two
  instances on a page get different ids, and every request starts at 1 (P8). Qwik concatenates, as
  `qwik/use-method-usage` refuses a hook called inside a template literal. An authored id with the
  prefix stays UF3005.

- **The normaliser renames generated ids wherever they stand** (amends ADR-0031). A token that
  starts `uf-id-` and runs on over the characters the frameworks' ids use (`(?<![\w-])uf-id-[\w-]+`:
  Vue's `v-0`, React's `_R_2_`, Svelte's `s1`, Solid's `cl-1`, Qwik's `B2t0`, Angular's and
  Astro's `name-0`) is renamed `uf-id-N` by first appearance in document order, in every
  attribute value and text node, not only in `id` and the idref attributes: a radio group's `name`
  and a `data-*` value are ids too. A class's tokens are sorted again once renamed. An author's
  suffix (`${id}-1`) makes another id, numbered on its own, so a follower whose suffixed id equals
  another id still differs from the reference. The step's ARIA snapshot and an event's payload are
  renamed by the same map (ADR-0050). `replaceIdReferences` stays the analyser's rule (UF3005).
- **Amendment to ADR-0034.** An Astro component that reads no prop exports its `Props` only when
  its frontmatter does not name `Astro`. The `useId` helper names it, and astro-eslint-parser counts
  Astro's own read of `Props` in a file that names `Astro`, so `no-unused-vars` holds without the
  export.

From `ids/label-association`, two ids that tie a label and a hint to a field:

```text
Source   const inputId = useId();  const hintId = useId();
Svelte   const uid = $props.id();  const inputId = `uf-id-${uid}-0`;  const hintId = `uf-id-${uid}-1`;
Angular  protected readonly inputId = `uf-id-email-field-${nextId++}`;
Astro    function uniqueId(): string {
           const locals = Astro.locals as { ufIdCount?: number };
           locals.ufIdCount = (locals.ufIdCount ?? 0) + 1;
           return `uf-id-${locals.ufIdCount}`;
         }
Every target renders   <label for="uf-id-1">  <input id="uf-id-1" aria-describedby="uf-id-2">   (normalised)
```

## Consequences

**Positive:**

- A template ref is the element or `null`, on six targets, at the same points of the component's
  life, and the source's own annotations (`let stored: HTMLElement | null`) type-check on each.
- Client code may change what the template leaves alone (a class, a style or an attribute it does
  not bind), and is stopped only where a framework would undo or keep the change differently.
- Ids tie labels, hints, radio groups and ARIA references on all seven targets, each instance its
  own, and the normaliser compares them without reading any framework's format.

**Negative:**

- A template ref cannot be attached in a list, and an element cannot be rebuilt by hand; a list of
  elements waits for refs to components (M3) or a pattern of its own.
- Angular and Qwik spell an element read whole with `?? null`, Angular and Astro carry a helper for
  ids, and Qwik one for refs in conditionals.
- A Svelte component calls `$props.id()` once, so its ids are derived (`uf-id-<uid>-0`, `-1`), not
  the framework's own each.
- An authored text that happens to start `uf-id-` is renamed too, identically on every target.

**Open:**

- M3: refs to components, `defineExpose`, and form state (`v-model`).
- M8 (L12): hydration needs the server's and the client's ids to match. Solid's server ids and its
  client's `cl-` ids differ, and Angular's and Astro's counters start again on each side.

## Alternatives considered

- **A string key, as Vue writes it** (`ref="input"`). The JSX targets would need a lookup, and the
  key would be a second name for one binding (plan §4.2).
- **Refs in lists, as an array.** Vue gives an array and the others the last element: one rule
  would need a helper on six targets.
- **Keep each framework's empty value, and require a loose test** (the first build's UF3028
  clause). It rejected `=== null`, which every target can run alike once each empties to `null`,
  and the source's `T | null` annotations still failed L4 on four targets.
- **Report every class, style and attribute change of a rendered element** (the second build).
  It rejected an autosizing textarea and `aria-busy`, which no target's template binds, and every
  target keeps.
- **Solid: Solid's own `let field!: T; ref={field}`.** It fails `no-unassigned-vars`, and the
  removed element would stay in the variable. A signal setter would keep it too.
- **Svelte: a `$state` for every ref.** Nothing tracks a ref (UF2010), and Svelte's documentation
  binds a plain variable where nothing conditional holds the element.
- **Svelte: an unsuffixed first id** (the first build, `uf-id-${uid}` then `uf-id-${uid}-1`). The
  source's `${base}-1` then spelled the second id.
- **Astro: a counter in the frontmatter, in a module, or a random id.** The first restarts for each
  instance, the second grows across requests, and the third differs between two renders (P8).
- **Angular: a counter without the component's name.** Two components on one page would share
  numbers only by chance; the name keeps each counter apart.
- **Recognise each framework's id format in the normaliser.** ADR-0031 rejected it: Qwik's format
  matches ordinary words. The prefix is what makes renaming every value safe.

## Evidence

- `packages/analyzer/test/listeners.test.ts`: "lowers `ref` to the template ref it attaches",
  "renames `ref` written in another case, with a safe fix (UF3004)" and "reports a ref that is no
  template ref, one attached twice, in a list or never (UF3027)".
  `packages/analyzer/test/rules.test.ts`: "reports a change of the element's structure or text",
  "accepts any test of an empty ref, properties and methods that change no structure", "judges a
  change by where the element comes from: a chain, an alias, the event's elements", "reports a
  change of the classes or the style of an element whose template binds them", "judges a
  listener's own element by the elements whose listeners pass it the event, its target by what
  they hold", "accepts a change of the classes or the style no template binds, and of any
  attribute", "judges an iteration's elements as the template's, and never their `classList` as
  state's collection", "accepts the methods that change no rendered structure or attribute, and the
  document's own elements", "accepts a setup `let` or a template ref read in what `watchEffect`
  hands on to run later" and "reports a setup `let` or a template ref read in a template, a getter,
  an initial value, a watched getter or `watchEffect`".
  `packages/analyzer/test/client-rules.test.ts` "reports a template ref read at unmount and in a
  cleanup, itself or through a function".
- `packages/codegen/test/setup.test.ts` "derives interactivity from a listener, or from a template
  ref alone"; `packages/codegen/test/markup.test.ts` "writes Svelte's event attributes and
  `bind:this`", "writes Angular listeners from the statement its target supplies, and `#name` refs"
  and "refuses a listener or a ref in Angular's literal region, where nothing binds".
- Vue 3.5.43: `packages/target-vue/test/behaviour.browser.test.ts` "sets a ref keyed by its
  binding's name, and empties it once its element is removed" and "gives each instance its own id,
  with the generated prefix"; `packages/target-vue/test/emit.test.ts` "keys a template ref by its
  binding's name, prefixes an id, and writes effects with Vue's APIs";
  `packages/target-vue/test/lint.test.ts` "rejects $what ($rule)" on "a template ref after another
  attribute" (`vue/attributes-order`). runtime-core's `setRef` skips a setup binding
  `useTemplateRef` returned (`knownTemplateRefs` in development, `isTemplateRefKey` in production):
  a probe's finding.
- React 19.3.0: `packages/target-react/test/setup.test.ts` "declares template refs and setup lets as
  refs, ids with the uf-id- prefix, and lifecycle hooks as effects" and "sets a template ref typed
  otherwise than its element through a ref callback, and types an untyped one with its element's
  interface"; `packages/target-react/test/toolchain.test.ts` "types a template ref with the
  interface the authoring types give its element, which React's ref takes".
- Svelte 5.57.1: `packages/target-svelte/test/emit.test.ts` "declares a template ref `T | null`,
  with $state only where a condition renders its element", "declares an untyped template ref
  `unknown`, holding null" and "takes one id from $props.id() and derives every id from it with a
  suffix"; `packages/target-svelte/test/toolchain.test.ts` "passes L3, L4 and L5 on what the target
  emits for each shape" (the `refs` shape keeps the element in a `T | null` local and setup `let`;
  it fails with the old declarations, two TS2322);
  `packages/target-svelte/test/behaviour.browser.test.ts` "reads the DOM after nextTick, and finds a
  ref empty once its element is gone" and "ties ids from one $props.id(), each starting uf-id- and
  ending in its own suffix"; `packages/target-svelte/test/lint.test.ts` "rejects $what ($rule)" on
  "a template ref's text replaced" (`svelte/no-dom-manipulating`).
- Solid 1.9.15: `packages/target-solid/test/setup.test.ts` "spells state, derived values, template
  refs, ids, constants and lets"; `packages/target-solid/test/behaviour.browser.test.ts` "runs
  lifecycle hooks in the browser, empties a template ref with its element, and coalesces between
  awaits"; `packages/target-solid/test/lint.test.ts` "rejects $what ($rule)" on "a template ref as a
  `let` Solid's compiler assigns".
- Angular 22.2.1: `packages/target-angular/test/setup.test.ts` "reads an element kept, passed,
  returned or compared as `T | null`, as the source types it" and "makes ids from a module counter,
  and keeps `this` in a function passed as a value";
  `packages/target-angular/test/effects.browser.test.ts` "keep, pass, return and compare an element
  as the source does, `null` when empty" and "resolves `nextTick()` once the DOM has updated, the
  ref empty once its element goes"; `packages/target-angular/test/events.browser.test.ts` "focuses
  elements through template refs" and "gives each instance its own ids, which the label and the hint
  refer to"; `packages/target-angular/test/render.test.ts` "gives every id the compiler's prefix".
- Qwik 2.0.0-beta.47: `packages/target-qwik/test/setup.test.ts` "keeps a template ref in a signal
  and an id under the generated prefix", "waits a task in nextTick, and reads a ref in a
  conditional through rendered()" and "reads a template ref's value that the source uses whole as
  T | null"; `packages/target-qwik/test/behaviour.browser.test.ts` "reads the DOM after nextTick,
  and an empty ref once its element is gone"; `packages/target-qwik/test/lint.test.ts` "rejects
  $what ($rule)" on "a hook called inside a template literal".
- Astro 7.3.5: `packages/target-astro/test/setup.test.ts` "declares each id from a helper that
  counts on `Astro.locals`", "gives two instances on one page different ids, and each request the
  same ones" (a page of two instances renders `uf-id-1` to `uf-id-4`, twice the same HTML) and
  "does not export `Props` when the helper names `Astro`, which reads it (L5)". The cast of
  `Astro.locals` to a weak type compiles whatever a project declares in `App.Locals`, under
  TypeScript 6.0.2: a probe's finding.
- The normaliser: `packages/testing/test/normalize.rules.test.ts` "renames a generated id in every
  attribute value and text node, in document order", "ends an id where an id character stops, and
  reads a suffixed id as another id", "sorts a class's tokens again once its ids are renamed",
  "normalises Vue's and each follower's ids to one text" (a radio group's `name` and
  `${base}-${index}` rows beside a second id, in the seven targets' formats) and "still tells two
  ids that collide on a follower and not on the reference"; `packages/testing/test/trace.test.ts`
  "renames the generated ids a payload carries as the step's DOM does" and "renames the generated
  ids the ARIA tree carries as the step's DOM does"; `packages/testing/test/dom.browser.test.ts`
  "gives the renaming of the generated ids it found, for the payloads of a trace's step";
  `packages/testing/test/events.test.ts` "renames generated ids as the DOM's map does, and numbers
  the others after them".
- The corpus cases `refs/focus`, `ids/label-association`, `ids/radio-group`, `lifecycle/next-tick`,
  `lifecycle/mounted-dom`, `lifecycle/click-outside`, `events/listener-pairs`,
  `state/derived-arrays` and `effects/flush-post` are green at every live layer on all seven
  targets; `lifecycle/next-tick`'s "collapsed" scenario emits 0 rows once the list is removed, on
  the six interactive targets, and `ids/radio-group`'s shared expectations read the group's `name`
  renumbered (`uf-id-3`).
