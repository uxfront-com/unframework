# ADR-0058: Normalising Qwik's slot templates and bound `value` attributes

- **Status:** Accepted
- **Date:** 2026-10-18
- **Plan:** §4.5, §7.5, §9 M3; P1, P4; ADR-0031, ADR-0044, ADR-0049, ADR-0054; amends ADR-0031

## Context

ADR-0031 lets normalisation remove only a target's own noise, each rule with a negative test. The
M3 spikes (ADR-0053) found two composed outputs that render alike in the browser and still fail a
DOM or HTML comparison:

- **Qwik's server render keeps a slot's fallback in a hidden template.** When a consumer projects
  content into `<Slot>`, Qwik 2's SSR writes the unclaimed fallback after the component, as
  `<q:template aria-hidden="true" hidden=""><span>No details</span></q:template>`
  (`addUnclaimedProjection`), for resumption. The browser render does not have it. L6 fails on
  every case whose slot has fallback content.
- **React writes a controlled input's value into its `value` attribute.** react-dom 19.3 keeps the
  attribute in step with the value (`initInput` sets `element.defaultValue = value`, and updates go
  through `setDefaultValue`), while Vue's `v-model` sets only the property. L7 and L9 fail on
  every `v-model` on React: `- <input uf:value="hi">` against `+ <input uf:value="hi" value="hi">`.
  No React form avoids it: `defaultValue` is the attribute, and an uncontrolled input set from an
  effect loses the server's `value="hi"` (L6).

The normaliser already writes a control's state as `uf:*` pseudo-attributes (§7.5), so the state
itself compares on every target.

## Decision

- **Qwik's `q:template` elements are Qwik's noise.** On Qwik only, the normaliser removes a
  `q:template` element and its content, as it removes `q:*` attributes. It holds content that
  renders nowhere: `hidden`, `aria-hidden`, and absent from the client render.
- **A form control's initial state that equals its live state is written once** (rule 4d,
  `removeSettledValues`). On every target, the normaliser leaves out the markup of a control's
  initial state wherever its live state, a `uf:*` pseudo-attribute, says the same: an `<input>`'s
  `value` that equals its `uf:value`, an `<input>`'s `checked` where `uf:checked` is `"true"`, an
  `<option>`'s `selected` where `uf:selected` is `"true"`, and a `<textarea>`'s text that equals its
  `uf:value`. Vue's `v-model` sets the property alone, while Astro, which runs no client code, and
  React's `defaultChecked` and `defaultValue` write the initial state as markup. The live state is
  compared on every target, so the comparison loses nothing. Markup that differs from the state (a
  static `value="x"` after the person typed `y`, a box the person cleared) stays, and so does the
  markup of an element without a `uf:*` state, as in a server render. L10's geometry capture keys
  no `<textarea>` text for the same reason: it is the control's default value, which the control
  shows as its value and never lays out. The rule
  applies to every target, because a target-only rule would break the static case: React writes a
  static `value="x"` as `defaultValue`, which Vue writes as the attribute too, and both must still
  compare equal before anyone types.
- **The default value of a bound control is outside the contract.** It is what `form.reset()`
  restores and what a `[value="…"]` selector matches: Vue's is the server's `value` or nothing,
  React's follows the value. The semantics page says so.
- Each rule gets its unit test and a negative test in `@unframework/testing` (ADR-0031): a
  `q:template` on another target stays, and so does a `value` attribute that differs from the
  value, or one on an element with no `uf:value`.

## Consequences

**Positive:**

- Composition cases compare the DOM a person sees on Qwik and React, with no per-case exception.
- The `value` rule removes a repetition rather than a difference: the state stays in `uf:value`.

**Negative:**

- Every existing expectation with a static `value` equal to the field's value loses the attribute
  in its `dom.*` and `trace.*` files: the change that lands the rule regenerates them.
- A target that wrote a wrong default value equal to the current one would pass. Only
  `form.reset()` can tell, and the contract leaves it out.

**Open:**

- React, measured with M3's model cases: react-dom writes a controlled checkbox's or radio's first
  `checked` state as its attribute and never updates it, and keeps a `<textarea>`'s text in step
  with its state, where Vue sets the properties alone; a `<textarea>` React fills from its text
  also takes the caret at its start on focus, where Vue's leaves it at the end. So a stale
  `checked` stays where `uf:checked` is `"false"`. React's `models/checkbox-group` and
  `models/radio` cells at L7 and L9, and its `models/textarea` cells at L7, L9 and L10, are
  quarantined until rule 4d drops `checked` wherever `uf:checked` is set, and the caret is settled.

## Alternatives considered

- **A React-only rule for `value`.** It drops React's `value="x"` for a static field before anyone
  types, while Vue keeps it, so every static field would fail on React.
- **Declare React's `v-model` a capability difference.** Every model case would be skipped or
  quarantined on React, for an attribute nobody sees.
- **Remove `q:template` on every target.** No other framework writes it; ADR-0031 keeps a rule to
  the target whose noise it is.

## Evidence

From ADR-0053's spike worktree (React 19.3.0, Qwik 2.0.0-beta.47, `@qwik.dev/optimizer`
2.1.0-beta.9), with `UF_TARGETS=vue,<t>`:

- `ssr:qwik -t 'spike/'`: `form` fails L6 on `<q:template aria-hidden="true"
hidden=""><span>"No details"</span></q:template>` alone, for every slot candidate tried;
  `hazard`, `list` and `table` pass. `browser:qwik` passes every cell of all four.
- `browser:react cases/spike`: `form` and `hazard` fail L7 and L9 on `- <input uf:value="hi">` /
  `+ <input uf:value="hi" value="hi">` alone; L8, L10, L11 and L13 pass, as do `list` and
  `table`. `ssr:react` passes all four (the server writes `value="hi"` on Vue too).
- Qwik showed the same attribute from `bind:value` and from `value={signal.value}` (the optimizer
  makes them const props, which the client writes as attributes); a value read in render is set as
  the property and passes, so Qwik's mapping avoids it (ADR-0054).
