# ADR-0033: What a framework renders differently is a declared capability, on the reference too

- **Status:** Accepted, amended by ADR-0047
- **Date:** 2026-10-02
- **Plan:** §11 D10; P2, P4; §5.7 (capabilities), §7.4 (`requires`); ADR-0014, ADR-0026

## Context

Some IR renders differently on one framework, though the source is valid HTML and every other
target renders it exactly. If neither the analyzer nor the target says so, the output is silently
wrong (P2), and P4 asks that such a deviation be declared in the capability matrix, never
discovered. The first known case is on Vue, the reference target (ADR-0014):

- A single-selection list box, `<select size="2">` without `multiple`, starts with no option
  selected in HTML and on every other target.
- Vue's client mount (`runtime-dom`'s `nodeOps.createElement`) sets `multiple` before the
  children but not `size`. The options are inserted while the select is still a drop-down, so
  HTML selects the first enabled option, and setting `size` afterwards does not undo it.
- Vue's server render, its hydration and its stringified static templates are right, so only a
  component mounted on the client differs, and its form submits a value the source does not
  select.
- In Chromium, `:size`, `v-bind`, `v-pre` and option groups all select index 0. Only
  `:multiple="false"` avoids it, by relying on how `runtime-dom` tests `props.multiple` and on prop
  order, which would go wrong silently if Vue changed either.

A first fix reported the list box from inside Vue's `emit`. That was loud, but invisible to the
matrix, so `requires` could not skip it and nothing that reads the matrix knew of it.

## Decision

- **A construct one framework renders differently is a capability**, derived from the IR like the
  others, and every target declares it. The first is `listbox`: a `<select>` shown as a
  single-selection list box (display size above 1 by HTML's rules for parsing non-negative
  integers, no `multiple`) holding an option a drop-down would select (not disabled by itself or
  its option group). The HTML fact is `listBoxSize` in `@unframework/ir`.
- **Vue declares `listbox` unsupported**, with UF4001 at severity `error` and the reason
  "runtime-dom's `nodeOps.createElement` sets `multiple` but not `size` before the options are
  inserted"; the other six declare it native. Vue's `emit` stays the printer alone.
- **One derivation, located.** `requiredCapabilities` lives in `@unframework/codegen` and returns
  each capability the module uses with the span of its first use; the compiler's capability check
  reports the diagnostic there (`listbox` at the list box's `size`).
- **The reference renders nothing it declares unsupported.** Because Vue writes the shared
  expectations, no corpus case may contain a list box until Vue fixes it. When M3's form cases need
  one, the case uses `requires` to skip Vue and needs another reviewed source of expectations.
- **Render-parity tests hold the matrix to the framework** (ADR-0026). The kit derives each case's
  capabilities. On a target whose matrix marks one unsupported, the client test leaves the case
  out of its comparisons and checks that it still renders differently, failing with "change the
  matrix" once the framework renders it exactly. Every other case must render exactly, and a
  target that reports anything from `emit` fails the kit. Server parity still compares every case,
  because Vue's server render is right.
- **The upstream fix is to set `size` in `nodeOps.createElement`, beside `multiple`**, as React
  does at creation. The issue is to be filed at vuejs/core with the reproduction
  `<select size="2"><option>a</option><option>b</option></select>`.

## Consequences

**Positive:**

- A framework quirk is declared in the matrix and reported at the construct, on the reference
  target too, and `requires` can skip it with a reason.
- The cell is tied to a test that notices when the framework is fixed.
- Every capability diagnostic is now located at its first use, not at the start of the file.

**Negative:**

- A Vue user cannot write a single-selection list box until Vue changes. A capability cell has no
  help text, so the diagnostic says only "Remove the feature, or drop the target."
- Every target, third-party ones included, declares a cell for one framework's quirk; a target
  that does not is treated as not supporting it (UF4001 "does not declare"), and only for modules
  that use a list box.

## Alternatives considered

- **Report it from Vue's `emit`.** Loud, but not declared in the matrix (P4), so `requires` and any
  tool reading the matrix cannot see it. Built first and replaced by this decision.
- **Emit `:multiple="false"` before the options.** It works in Chromium today, but only through an
  implementation detail of `runtime-dom`, and it would fail silently if that changed.
- **Reject the list box in the analyzer for every target.** Six targets render it exactly; the
  limitation is Vue's.

## Evidence

- `packages/ir/test/listbox.test.ts`: HTML's integer parsing (` 2`, `\t+3`, `2px`, `007` are list
  boxes; `1`, `0`, `-0`, `-2`, `x` are not), `multiple`, disabled options and option groups.
- `packages/compiler/test/capabilities.test.ts`: through `compile()` on all seven targets, exactly
  one UF4001 error, on Vue only, spanning `size="2"`.
- With Vue's `listbox` marked native, Vue's client parity test in Chromium fails on the two
  tricky list-box cases and the sweep's `<select size>` (`selectedIndex` -1 → 0, `value` `""` →
  `"a"`); with Vue's `text` marked unsupported, every affected case fails with "change the
  matrix".
