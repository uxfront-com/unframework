# ADR-0060: React's bound controls and Angular's host spaces

- **Status:** Proposed
- **Date:** 2026-10-19
- **Plan:** §6 (React, Angular), §7.2 (L7, L9, L10), §7.5, §9 M3; P1, P4, P6; ADR-0010, ADR-0031,
  ADR-0033, ADR-0054, ADR-0056, ADR-0058; amends ADR-0010, and settles the open items of ADR-0056
  (the accessible-name space) and ADR-0058 (React's checked controls and `<textarea>`)

## Context

M3 left 10 cells in the quarantine, each a difference the M3 records named and left open:

- **React's checked controls** (`models/checkbox-group`, `models/radio`, L7 and L9). react-dom
  writes a controlled box's first state as its `checked` attribute (`defaultChecked`) and never
  updates it, as it does an option's `selected`. A box the person clears keeps the attribute while
  its `uf:checked` reads `"false"`, and rule 4d keeps a `checked` the state no longer holds, on
  purpose (ADR-0058).
- **React's `<textarea>`** (`models/textarea`, L7, L9 and L10). ADR-0058 left the caret to measure.
  The typed step's `uf:value` reads `" and breadBuy milk"` on React, and `"Buy milk and bread"` on
  Vue: react-dom fills the field as its default value (`initTextarea` sets `defaultValue`, then
  `value` to the same text), which leaves the caret at the start, where Vue's `vModelText` sets
  `value` on a field that starts empty and the caret ends after the text. A script's focus or the
  `Tab` key keeps the caret where it is, so the next key a person types lands before the text. That
  is a defect of React's output, not noise.
- **Angular's host space** (`components/named-import`, `fallthrough/class-and-style`, L7, and the
  latter's L9). Playwright's ARIA snapshot puts a space at the start and the end of every element
  whose `display` isn't `inline` (its `processElement`), and an Angular host is `display: contents`
  (ADR-0010). Two components side by side as inline content read `Build passing` there, where the
  other targets read `Buildpassing`. ADR-0056 put the space down to Chrome's accessible name; the
  snapshot that L7 compares computes it itself. ADR-0010 promised that L7's accessibility tree
  shows the host changes nothing. The DOM, the pixels and the behaviour match.

React's checked controls also differ in one way the contract already leaves out (ADR-0054): their
`v-model` is controlled `checked` with React's `onChange`, which React fires on the DOM's `click`,
before `input`, so a listener of the control's `input` reads the model the click wrote. The
`two-way-binding` cell is native, and a native cell takes no note (`CapabilityCell`), so nothing
declares it.

## Decision

- **React's stale `checked` and `selected` attribute is React's noise** (rule 4e,
  `removeReactDefaultStates`). On React only, the normaliser removes an `<input>`'s `checked` and an
  `<option>`'s `selected` wherever the element's `uf:checked` or `uf:selected` is there, whatever it
  says. The live state still compares, so a box that is still checked still differs. Rule 4d keeps
  such an attribute on every other target, where only the source's markup writes it, and an element
  without the `uf:*` state (a server render) keeps it on React too (ADR-0031).
- **React puts a bound `<textarea>`'s caret after its text once it is mounted.** The element's ref
  callback, declared once with `useState`, empties the field and sets its text again, as Vue's
  `vModelText` sets the text of a field that holds none, so the caret ends after it. It fires no
  event: `setSelectionRange` would fire a `select`, which Vue doesn't. A template ref or native
  listeners on the element share the callback. A callback written in place (its listeners read a
  list's row or a narrowed value) runs at every render, so it leaves the caret alone, at the start.
  The `two-way-binding` cell stays native: no helper is added.
- **Angular's host space is removed from the ARIA snapshot at the hosts' positions** (the ARIA
  snapshot rule, `removeHostSpaces`). On Angular only, the view reads the live DOM's computed styles
  and lists each host edge with a word on either side and no whitespace between them, inside one
  run of text (`hostJoins`), with the number of times the text writes `before after`, with its own
  whitespace, before the join. The rule removes the space in the occurrence of `before after` that
  follows those, and no other, so a space the source writes between the same words stays. An element that isn't inline, or has a role, ends the run, since the
  snapshot spaces or splits it on every target. This amends ADR-0010: L7 compares the tree with
  that space removed, so it shows the host changes nothing else. Attribute selectors stay out of M3
  (ADR-0056).
- **The targets page declares React's native cell.** A note under the table states the `onChange`
  write and the `input` order, react-dom's attribute and the caret, and the Angular host section
  states the space. `AGENTS.md` says the same.

## Consequences

**Positive:**

- The quarantine is empty: every case passes every live layer on React and Angular.
- People typing into a React `<textarea>` start where they would on Vue.
- Each rule is scoped to one target, with a negative test: on React, a box still checked; on
  Angular, a missing word.

**Negative:**

- A React box whose `checked` attribute is wrong but whose state is right passes. Only
  `form.reset()` or a `[checked]` selector could tell, and ADR-0058 leaves a bound control's default
  state outside the contract.
- Rule 4e also removes the `checked` a source writes on a box with no `v-model`, since every box
  has its `uf:checked`. Once the person clears such a box, Vue keeps the attribute and React
  doesn't, so React fails. No case has one.
- The host rule matches words in the snapshot's text. A word the snapshot quotes or escapes, or one
  ARIA text splits, removes nothing, so such a case fails loudly rather than passing.
- A React `<textarea>` with a `v-model` and a native listener that reads a list's row or a narrowed
  value keeps the caret at the start. No case has one; the targets page states the exception.

## Alternatives considered

- **Rule 4d drops `checked` wherever `uf:checked` is set, on every target** (ADR-0058's open item).
  It would stop comparing the `checked` a source writes on a box without a `v-model` on every
  target, to remove React's noise, so a target that dropped that attribute would pass.
- **Declare the caret as noise and normalise it.** The typed text differs, and so does what a person
  sees, so no rule can remove it without hiding a real difference.
- **Remove every space next to a host's text from the snapshot string.** The string alone cannot
  tell a host's space from one the source writes between the same words.
- **A capability for the host space.** It needs a cell in all seven targets and skips whole tests
  (ADR-0033).

## Evidence

From the stage-7 branch at `1e6c5ccd`, with the 10 entries removed, React 19.3.0, Angular 22,
Playwright 1.63.0:

- `browser:react cases/models/textarea`: L7, L9 and L10 fail on `- uf:value="Buy milk and bread"` /
  `+ uf:value=" and breadBuy milk"` alone. With the caret callback they pass, and
  `target-react`'s `types after a bound textarea's text` fails without it on `' nowBuy milk'`. With
  `setSelectionRange` in the callback, the same test hears a `select` at mount, which Vue doesn't
  fire.
- `browser:react cases/models/checkbox-group cases/models/radio`: L7 and L9 fail on
  `+ <input checked="" … uf:checked="false">` alone, and pass with rule 4e.
- `browser:angular`: `- paragraph: Buildpassing` / `+ paragraph: Build passing` and
  `- text: plainwidetoggled` / `+ text: plain wide toggled` alone, and pass with the host rule.
  `browser:vue`, `browser:react` and `browser:angular` pass every case.
