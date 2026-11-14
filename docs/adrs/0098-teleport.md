# ADR-0098: Teleport

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §4.3, §5.3, §6, §7.2 L5 to L12, §9 M8; P4, P7; ADR-0033, ADR-0053, ADR-0057, ADR-0063,
  ADR-0085, ADR-0095; amends ADR-0042 (React's L5 allow-list takes `react-dom`) and ADR-0085
  (the harness captures what a view appends to `body`, and fails a test that leaves an element
  there)

## Context

Overlays need to render outside their component's box: a dialog, a menu or a listbox in M10 sits
over the page, not inside the card that opens it. Plan §4.3 lists `<Teleport>` for M8, and §5.3
names a `Teleport` render node. Every target can mount content elsewhere, but each does it
differently:

- Vue has its own `<Teleport>`.
- React has `createPortal` in react-dom, which its server render (Fizz) refuses.
- Solid has `<Portal>`, which wraps its content in a `<div>`.
- Svelte, Angular and Qwik have no portal a component can use. Angular's CDK is no framework
  import (P7).
- Astro renders once, on the server, and runs nothing in the page.

A server render can't place content in another element of the page, so the rule has to say what
the server HTML holds.

## Decision

### The language

`Teleport` is an authoring API, written only as a tag: `<Teleport to="body">…</Teleport>`. The
compiler recognises it by the binding its import declares, as every authoring API. Any other use,
a call or a read as a value, is UF1002 at the identifier. The compiler checks how it is written:

- `to` is a static CSS selector, a string literal. A bound `to`, a template literal with
  expressions, an empty one or none is **UF3053** `teleport-target`, at the attribute.
- The content is exactly one element, which may hold anything. Text, two or more nodes, a
  component, a conditional, a list, a slot, `<component is>` or nothing is **UF3054**
  `teleport-content`. A condition goes around the `<Teleport>`, not inside it. With one element,
  Svelte, Angular and Qwik move one node and remove one node.
- Another attribute is UF3035, `key` outside a list UF3014, `ref` UF3046, a spread UF1002, and a
  teleport as a list's element UF1002. A teleport inside an `<svg>` is UF1002.
- The element is checked where the teleport is, as an element there would be: Svelte creates it
  there before it moves it, and its server build warns about an element its place does not permit,
  so `<div>` in a `<p>` is UF3003, with a note at the `<Teleport>`.
- `to` reads as JSX reads a string attribute, character references decoded, and each target writes
  that selector its own way. A reference only HTML decodes is UF3011, as on an element, without
  the fix: the character it writes can make a selector Angular's template refuses.
- `disabled` and `defer` are left out: only Vue's lowering of them would be native.

The IR node is `{ kind: "Teleport", to, children, span }`, whose invariants require one `Element`
child, a selector that isn't empty, and a place outside SVG. A component whose whole render is a
teleport is a root of kind `other`: the root is wrapped in a fragment, a parent's `class` or
`style` on it is UF3045, and no target hands it a parent's scope attribute.

### The semantic guarantee

- **Server HTML.** No target renders teleported content on the server. Comment markers and a
  framework's placeholders are allowed, since the normaliser drops them.
- **Mounting.** The content mounts once its component has mounted, in a later render on some
  targets. It is appended to `to`, after what `to` holds: the last element child of `to`. One
  component's teleports mount in source order. Vue also leaves two empty text nodes around it,
  which hold nothing.
- **Lifetime.** It unmounts with its component, or when a condition around the teleport turns
  false. Nothing is left in `to`.
- **Place.** It stays where it mounted while the list rows or the components that teleported it
  reorder, on every target, Vue's included. A teleport filled into a child's slot mounts only while
  the child renders the slot.
- **Not guaranteed:**
  - The holder's `onMounted` may run before the content exists. A component inside the teleport
    sees it in its own `onMounted`.
  - Whether an ancestor outside the teleport hears an event from inside it. React's synthetic
    events bubble through a portal, the DOM's don't.
  - What happens when `to` matches nothing. Each target renders nothing.
  - A selector across the boundary: `.panel .dialog` no longer matches a teleported `.dialog`.
  - The order in which the teleports of several components mount together, like a parent's and
    its children's. Vue and Qwik mount a parent's first, since each component's teleports wait
    for its own `mounted`, which flips in one render, where the parent renders first. React,
    Svelte, Solid and Angular mount the children's first. A teleport that mounts later goes after
    them on every target.

### The lowering

| Target  | Cell                       | Lowering                                                                                                                                                                                                                                                                                                                                                                |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue     | native                     | `<Teleport v-if="mounted" to="body">`, with a `mounted` ref set in `onMounted`. A plain `<Teleport>` buffers its content on the server and mismatches as it hydrates. A component whose root is a teleport sets `inheritAttrs: false`, so Vue doesn't warn about a parent's scope attribute.                                                                            |
| React   | emulated, `teleport`       | `{mounted ? teleport(<div …/>, "body") : null}`, with `mounted` from `useSyncExternalStore`, false on the server and while hydrating. The inline `teleport` is `createPortal` into the element `to` selects, or `null`. The output imports `react-dom`, React's renderer, and a React package peers on it.                                                              |
| Solid   | emulated, `Teleport`       | `<Teleport to="body">`, an inline helper that copies `<Portal>`'s branch without a wrapper: in `onMount`, it inserts the children into `to` in a root its owner owns, and a signal empties the insertion on cleanup.                                                                                                                                                    |
| Svelte  | emulated, `teleport`       | `{#if mounted}<div {@attach teleport("body")} …>{/if}`, with `mounted` set in `onMount`. The attachment appends the element to `to`, gives back the focus the move took, and removes it on teardown.                                                                                                                                                                    |
| Angular | emulated, `Teleport`       | `<ng-template ufTeleport="body">`. After a render that leaves its anchor in the document, its inline directive creates the template's view, attaches it to the application, appends its nodes to `to`, and refreshes it after every render. A render's teleports mount in the order of their anchors. A root teleport takes its parents' scope attributes off the host. |
| Qwik    | emulated, `teleport`       | `{mounted.value && <>{""}<div ref={teleport("body")} …/></>}`, with `mounted` set by a `document-ready` visible task. The ref moves the element into `to` once Qwik has inserted it, puts it back there when Qwik moves it with its component, removes it once the element that held it leaves the document, and stops watching once it is gone.                        |
| Astro   | unsupported, UF4001 (info) | Prints nothing: a static page has no client to mount the content.                                                                                                                                                                                                                                                                                                       |

Some lowerings differ from the plan's starting points, each for a reason the cases found:

- **Angular refreshes its view after every render** (`afterEveryRender`). Zoneless change
  detection refreshes a view attached to `ApplicationRef` only when it is dirty, and a teleported
  view reads the component's `@let` values, which mark it dirty in no signal. A view in the
  directive's own view container would stay fresh, but Angular creates content projected into a
  slot whether or not the slot renders, and its projection inserts every view of the container,
  the moved nodes included, into the slot. So the view is in no container, and it mounts only
  while its anchor is in the document: a template projected into a slot that isn't rendered has
  none.
- **Angular orders its teleports.** It runs a render's callbacks in no source order: each teleport
  queues itself in the `earlyRead` phase, and the first `write` callback mounts them all, sorted by
  their anchors' position in the document.
- **Qwik's moved element stands in for its container.** Qwik finds a handler's container with
  `element.closest("[q:container]")`, which an element moved out of a container that is not
  `<html>` no longer reaches. The helper copies the container's `q:container` attribute, which
  the normaliser drops, and its `qContainer` onto the element. In an SSR page, whose container is
  `<html>`, `body` is inside it and nothing is copied. `qContainer` is an internal of Qwik's,
  which the target may read because Qwik is pinned exactly to its release candidate (ADR-0094):
  a Qwik bump runs the teleport cases, which a change to it breaks.
- **Qwik's helper watches the element that held the teleport**, not the empty text before it. A
  capture merges adjacent text runs, which detaches that text for a moment. Qwik removes the
  element itself with its branch, and only the outermost node of an element it removes, so the
  helper removes it once its holder leaves the document, and stops watching once the element is
  gone, removed by Qwik or by itself.
- **Qwik's helper puts back an element Qwik moves.** Qwik moves a component by moving every DOM
  node under it, so a keyed list that reorders components whose root is a teleport pulls their
  elements back into the page. Each element sits in `to` after an empty text of its own, which no
  capture shows and nothing else moves, and the helper puts it back after that text. Its place
  holds however many components move in one render, since no element's place depends on
  another's.

Svelte and Qwik move the element after a component inside it may have focused one of its
elements, and moving a node blurs it, so both give the focus back.

### The harness

The approved section asks L7, L9, L10, L11 and L12 to see what a scenario teleported. The harness
does it in five parts:

1. **Tracking.** Whatever a view's render appends to `document.body` is the view's: each element
   child of `body` that holds no mount root and wasn't there when the test started, claimed by the
   view or the client render that reads it first. The harness reads a view right after each of its
   actions settles, so what an action teleported goes to the view that acted.
2. **Captures.** Every capture covers the container, then the claimed elements, in `body` order:
   - **DOM** (L7, and L9 through the same capture): each element follows the container's children
     in a `<uf:teleported>` marker, which shows which nodes left the component.
   - **ARIA:** each element's snapshot follows the container's.
   - **Geometry:** each element is measured from the container's origin, under `uf:teleported[i]/`.
   - **Screenshot:** the clip is the union of the boxes.
   - **axe:** the context includes each element.
   - **L12:** the hydrated view's capture, and the client render's, which claims its own.
3. **Queries.** A claimed element carries a test id of the view's, `uf-root-N-teleported`. A
   query of the view matches what the container holds, what a teleported element holds, and a
   teleported element itself, which a query chained from it never matches: `q` is
   `container.q.or(teleported.q).or(page.q.and(teleported))`. `view.user` names its step `q`, as
   before, the same on every target. The DOM capture never shows the stamp, `view.locator` is the
   container alone, and an element with a test id of its own fails the test.
4. **The after-test check.** After `cleanup()`, `body` holds no element the test added, or the
   test fails L8, naming each one. This proves "unmounts with its component" for every case.
5. **The normaliser** drops Qwik's visible-task placeholder, an empty `<script hidden>` that only
   Qwik writes for a component that renders no element of its own.

## Consequences

- `<Teleport to>` compiles to the seven targets, and Astro renders nothing for it.
- A React package peers on `react-dom`, and a React output may import it (L5).
- `@unframework.dev/testing` changes for a design system's own tests (`defineTestConfig`): a test
  that leaves an element in `body` fails L8, like a toast container a library never removes, and
  the DOM, ARIA, geometry, screenshot and axe captures include what a view appended to `body`.
- P6's click-outside and focus-trap cases may teleport: the view's queries reach the content.
- P7's leave transitions must be over by `cleanup()`.
- The cases are `teleport/basic`, `teleport/dialog`, `teleport/siblings`, `teleport/root`,
  `diagnostics/teleport-target` and `diagnostics/teleport-content`.

## Alternatives considered

- **Several nodes as the content.** Svelte removes a branch by walking `nextSibling` from its start
  node to its end node, which breaks once they move, and Angular and Qwik would move a range.
  One element keeps every lowering to one node, and every overlay has one root.
- **Solid's `<Portal>`.** Its `<div>` wrapper would differ from every other target's DOM.
- **Angular's CDK portal.** It is a package of its own, which no output imports (P7).
- **A Qwik portal through its own `render`.** It would start a second container, which neither
  shares the component's state nor renders twice into `body`.
- **Stamping each teleported element with an attribute of the harness's own**, which the view's
  queries would match beside the container. Vitest's locators take no CSS selector, so the
  queries could only reach it through the test id.
