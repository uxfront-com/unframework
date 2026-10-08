# ADR-0056: Angular composition: roots, fallthrough, slots, event names

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §6 (Angular), §7.5, §9 M3; P2, P4, P6; R5; ADR-0010, ADR-0012, ADR-0027, ADR-0031,
  ADR-0042, ADR-0047, ADR-0053, ADR-0054; amends ADR-0010, ADR-0042 and ADR-0047

## Context

ADR-0010 gave every Angular component an element host styled `display: contents` and left M3 three
questions: whether axe-core sees through a host between a consumer's `<ul>` and a component's
`<li>`, where fallthrough attributes land, and whether attribute selectors are needed. ADR-0047
turned angular-eslint's `no-output-native` off and left its hazard to M3: an output named like a
native DOM event (`change`) also hears that event when it bubbles out of the component through its
host. ADR-0054's mapping needs Angular's answers for slots, models and recursion too. The spikes
answered each with Angular 22.2.1 under ngtsc's strict templates (ADR-0053's Evidence).

## Decision

**Hosts stay elements, and a contextual root is unsupported.**

- A component whose root element is one that HTML or ARIA ties to its parent is unsupported on
  Angular: `contextual-root`, UF4001 (error), reported at the root element. The elements are
  `li`, `dt`, `dd`, `tr`, `td`, `th`, `thead`, `tbody`, `tfoot`, `caption`, `colgroup`, `col`,
  `option`, `optgroup`, `summary` and `legend`. With a `uf-*` host between them and their parent,
  axe reports `list` and `listitem` violations, and the HTML parser moves a host out of a table, so
  the server HTML does not survive parsing.
- A component used as a list's item keeps the `<li>` in the parent and renders its content:
  `items.map((item) => <li key={item.id}><Item item={item} /></li>)` works on every target.
- Attribute selectors (`tr[ufRow]`) remain deferred (ADR-0010; the PLAN's non-goal). They would
  lift the limit; the probe below shows what they cost. A record that adds them makes
  `contextual-root` native.

**Props are bound.** A static prop is written as a binding, `[label]="'Name'"`: a static attribute
sets the input but also stays on the host, which then is not unwrapped (ADR-0010).

**Fallthrough moves `class` and `style` through inputs** (`fallthrough`, emulated). A component
that inherits them declares `readonly class = input<string>()` and `readonly style = input<…>()`,
merges them into its root element's `[class]` and `[style]`, and clears them from the host with
`host: { "[attr.class]": "null", "[attr.style]": "'display: contents'" }`, so the host carries only
its own style and is unwrapped. A static `class="wide"` and a bound `[class]` both reach the input.
A component with `inheritAttrs: false` declares neither input and still clears the host. This
answers ADR-0010's open item without changing ADR-0031's unwrapping rule.

**Slots go through `ng-content` and one directive per named slot.**

- The default slot is `<ng-content />`, with its fallback as `<ng-content>`'s content.
- Each named slot, scoped or not, is a directive the component's file exports,
  `@Directive({ selector: "ng-template[ufFieldTitle]" })`, with `static ngTemplateContextGuard` so
  strict templates type the consumer's `let-` variables. The component reads it with
  `contentChild(FieldTitle, { read: TemplateRef })` and renders it with `ngTemplateOutlet` under
  `@if`, which gives presence and fallback. It also writes `<ng-content select="[ufFieldTitle]" />`
  for each, so a slot's template never counts as default-slot content.
- A consumer writes `<ng-template ufFieldTitle let-item="item">…</ng-template>` and lists the
  directive in `imports` beside the component.
- Default-slot presence has no Angular API (`default-slot-presence`, UF4001). Forwarding a named
  slot re-declares the template under `@if (title(); as t)`; forwarding the default slot would
  re-project `<ng-content />`, which always counts as content, so it needs default-slot presence
  too.

**An output named like a native DOM event takes the `uf` prefix.** Where an event's name is one of
`no-output-native`'s native event names, the output is `uf` and the name in PascalCase
(`change` → `ufChange`), as the listener-option directives are named (`ufClickCapture`,
ADR-0047). A consumer listens with `(ufChange)`. `no-output-native` is on in L5, so a name the
compiler's list missed fails there. This amends ADR-0047's "outputs keep the source's event names"
for those names, and ADR-0042's rule set. The mount adapter maps an event to its output by the
target's rule.

**Models** are `model<T>(default)`, bound with `[(value)]="text"` on a signal; a native control's
`v-model` is `[value]` and `(input)`, or `[checked]` and `(change)`.

**Recursion** uses the component's own selector, with nothing in `imports`.

**The `ngtscVirtual` step** resolves and loads a parent's children before it compiles the parent
(ADR-0053).

## Consequences

**Positive:**

- ADR-0010's three open items are answered with measurements, and the host strategy stands.
- Fallthrough needs no change to normalisation, and bound `class` and `style` work.
- Scoped slots are typed for an Angular consumer, so L4's slot misuse fails on Angular too
  (ADR-0059).

**Negative:**

- A component whose root is a list item, a table part, an option or a summary has no Angular
  output until attribute selectors land; design systems must keep such elements in the parent.
- An Angular consumer writes `(ufChange)` where every other target keeps `change`.
- Each named slot adds a directive class to the component's file and to its consumers' `imports`.
- A component with `class` and `style` inputs gives up styling its host from outside, which its
  `display: contents` already made inert.

**Open:**

- Attribute selectors, in their own record, with a normalisation rule for their marker attribute
  and a `component-selector` lint configuration.

## Alternatives considered

- **Keep `class` on the host and change the unwrapping rule.** The host is `display: contents`, so
  a class there styles nothing and the rendered page differs; L6, L7 and L9 fail
  (`<uf-field class="wide" style="display: contents;"><div class="field" …>`).
- **`HostAttributeToken("class")`.** It moves a static `class` (L6 to L13 pass) but not a bound
  one; the inputs carry both.
- **Stop the native event at the component's root** (`(change)="$event.stopPropagation()"`, Angular
  Material's checkbox does this). It passes the hazard case, but the native event then never
  reaches the consumer's ancestors, as it does on every other target.
- **Guard in the consumer** (`value instanceof Event`). It needs a method per listener, fails
  strict templates inline (`TS2358`), and leaves hand-written consumers exposed.
- **An `ng-template #title` reference instead of a directive.** It compiles, but its `let-`
  variables are `any`, so a misused slot prop passes L3 and L4.
- **Attribute selectors now.** The table probe passed L10, L11 and L13, but differs at L6 and L7 by
  the marker attribute and fails L5's `component-selector` rule; it is its own decision.

## Evidence

From ADR-0053's spike worktree, with `UF_TARGETS=vue,angular`; Angular 22.2.1,
`@analogjs/vite-plugin-angular` 2.7.5, angular-eslint 22.5.0, axe-core 4.13.0, Playwright 1.63.0,
parse5 8.0.1.

- **`<ul>` with `<uf-item>` hosts around `<li>` roots (`spike/list`).** L6, L7 (DOM and ARIA tree
  after unwrapping), L10 and L13 pass; L11 fails:
  - `list (serious): <ul> and <ol> must only directly contain <li>, <script> or <template> elements`
  - `listitem (serious): <li> elements must be contained in a <ul> or <ol>` at
    `uf-item:nth-child(1) > li`

  axe run directly on the un-normalised DOM in Chromium (built with `createElement`, as Angular's
  renderer builds it) gives the same two violations; the ARIA tree equals Vue's, and the pixels
  are byte-identical to the host-free DOM.

- **`<tbody>` with `<uf-row>` hosts around `<tr>` roots (`spike/table`).** The server HTML is
  `…<tbody><uf-row style="display: contents;"><tr><td>Ada</td>…`. parse5 and Chromium both move
  the hosts out of the table, empty:
  `<uf-table …><uf-row …></uf-row><uf-row …></uf-row><table>…<tbody><tr>…</tr></tbody></table>`.
  The normaliser rejects it at L6 and in the browser (`normalizeHtml: the HTML parser had to repair
this markup … moved "<uf-row style=\"display: contents;\">" before "<table>"`). On the
  un-normalised client DOM, axe's table rules pass and `th-has-data-cells` is incomplete.
- **Attribute-selector probe** (`tr[ufRow]`): no repair; L10, L11 and L13 pass; L6 and L7 differ
  only by `<tr ufrow="">`; L5 fails `@angular-eslint/component-selector The selector should start
with one of these prefixes: "uf"`.
- **Static props:** `label="Name"` rendered `<uf-field label="Name" style="display: contents;"
tone="warn">` at L6; bound props leave the host bare.
- **Fallthrough:** with `class` and `style` inputs and the host bindings above, the parent's
  `class="wide"` and `[class]="extra()"` render `<div class="bold field wide" …>` with no
  `<uf-field>` wrapper in SSR and in the browser; inputs named `class` and `style` pass L3 to L5.
  An aliased input (`data-test`) fails L5 with `@angular-eslint/no-input-rename`. A
  `HostAttributeToken("class")` version passed L6 to L13 for a static class.
- **Slots:** the directive version passed L3 to L13 in `spike/form`. Without
  `<ng-content select="[ufFieldHint]" />`, the hint's template was projected into the default slot
  and its fallback disappeared. With `#hint` and no directive, `MisuseSlot`'s `size.toFixed()`
  raised nothing; with the directive, L3 and L4 report
  `TS2339 Property 'size' does not exist on type 'FieldHintContext'.`
- **Slot forwarding:** a template re-declared under `@if` reaches the inner `contentChild` at both
  levels in SSR, and the query updates when the `@if` toggles in the browser. A re-projected
  `<ng-content />` hid the inner component's fallback when the outer one received nothing.
- **The hazard (`spike/hazard`).** With an output named `change`, the test "hears only the
  component's change event" fails L7, L8 and L9: `Expected element to have text content: (empty)
Received: [object Event]`, while strict templates type `$event` as `string`, so L4 is clean.
  With `no-output-native` on, L5 reports `@angular-eslint/no-output-native Output bindings,
including aliases, should not be named as standard DOM events (line 16, column 12)`. A renamed
  output passes every layer with the rule on; so does stopping the event at the root. An inline
  guard fails L3 and L4 (`TS2358 The left-hand side of an 'instanceof' expression must be of type
'any', an object type or a type parameter.`).
- **Recursion:** `Tree` with `<uf-tree [depth]="depth - 1" />` under `@if`, no `imports`, passes
  L3 to L5 and renders three levels in `ssr:angular`.
