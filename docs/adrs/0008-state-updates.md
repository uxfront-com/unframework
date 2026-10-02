# ADR-0008: State is replaced whole, never mutated in place

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D4; §3, §4.2, §4.5, §4.6, §5.4, §6, P2, P7

## Context

In Vue, a ref that holds an object or an array is deeply reactive, so `list.value.push(x)` and
`form.value.name = x` both trigger updates. Not every target works that way.

- React's `useState`, Solid's `createSignal` and Angular's `signal` see a change only when a new
  value reaches their setter (§6).
- The compiler sees state changes as `write` and `update` references to a ref's `.value`, and
  rewrites each one into the target's form. React's `count.value++` becomes a setter call (§5.4).
- Deep `reactive()` proxies are a 1.0 non-goal (§3).
- P2: nothing is copied through unanalysed.

## Decision

- State is written through `.value`: `x.value = …`, `x.value++`, `x.value += …`.
- Objects and arrays are replaced whole.
- Mutating a ref's contents in place is an error, with a fix:

| Rejected              | Fix                                       |
| --------------------- | ----------------------------------------- |
| `list.value.push(x)`  | `list.value = [...list.value, x]`         |
| `form.value.name = x` | `form.value = { ...form.value, name: x }` |

- `reactive()` and `toRefs()` are outside the subset. They are diagnostics with no fix.

## Consequences

**Positive:**

- Every state change is a write the compiler can see by reference and rewrite per target (§5.4).
  Nothing changes state behind its back.
- The model maps directly onto setter-based primitives, with no deep proxy and no runtime
  (ADR-0015).
- Each write produces a new value, so a watcher's previous value is a distinct object from the new
  one, as the semantics contract's "correct previous value" needs (§4.5).

**Negative:**

- Nested updates are more verbose. Authors write spread copies.
- It departs from Vue, where deep mutation through a ref works. Vue habits hit the diagnostic,
  although the fix is mechanical for the common cases.
- Each update copies the value, which costs more than an in-place change on large collections.
- The analyser has to recognise in-place mutation through method calls and property writes, and
  report it rather than copy it through (P2).

## Alternatives considered

- **`reactive()` and deep mutation, with immer-style lowering.** Deep `reactive()` proxies are a
  1.0 non-goal (§3). Turning arbitrary in-place mutation into new values on the setter-based targets
  would need a helper, against P7 and ADR-0015, or far more syntax for the compiler to classify
  (P2).
