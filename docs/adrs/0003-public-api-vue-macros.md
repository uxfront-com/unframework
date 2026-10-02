# ADR-0003: The public API is declared with Vue macros

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §11 C3; §2, §3, §4.2, §4.3, §5.6, §8.7, R2, R3, Appendix A

## Context

Props live in the signature (ADR-0001), so stock tsgo checks them for every consumer. The rest of a
component's public API (events, models, slots and the exposed ref API) needs a home.

- The authoring APIs are Vue-inspired (§3), and Vue declares these with compiler macros.
- TypeScript infers only from a call's arguments, never from a function body (v1's ADR-008). Macros
  in a body therefore cannot type a component for its consumers.
- v1 spent two ADRs, a correction and a reverted channel on this, and still shipped
  `[attr: string]: any` (§2, R2).

## Decision

Events, models, slots and expose are declared with Vue's macros in the component body, imported
from `unframework` (ADR-0006).

| Concern | Declared with                                                                                     | Consumer writes                  |
| ------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| Events  | `const emit = defineEmits<{ change: [value: string] }>()`                                         | `onChange={…}`                   |
| Models  | `const open = defineModel<boolean>("open", { default: false })`                                   | `v-model:open={x.value}`         |
| Slots   | `const slots = defineSlots<{ default?(): JSX.Element; item?(p: { item: Item }): JSX.Element }>()` | children, or a slot object       |
| Expose  | `defineExpose({ focus })`                                                                         | the component-ref API per target |

- `defineOptions({ inheritAttrs: false })` takes a static object literal.
- v1's macro discipline stays: recognised by binding, called at the top level, statically
  analysable, erased. Macro results are bound, except for `defineExpose` and `defineOptions`.
- Consumer typing is solved on purpose, in four layers that are each useful on their own (§5.6):
  1. **Stock tsgo: no false errors.** `IntrinsicAttributes` accepts `on${Capitalize<string>}`
     handlers, `v-model` / `v-model:${string}` and slot-object children on every component. Probe
     tests pin what these targeted index signatures catch.
  2. **The compiler, always on.** The project graph reports UF3xxx diagnostics with "did you mean"
     for unknown events, models and slots, undeclared slot keys, and literals outside a union.
  3. **The content mapper (M5).** `@unframework/language-tools` serves virtual TSX that adds each
     component's macro-declared API to its exported signature.
  4. **The outputs.** L4 consumer type tests fail on every typed target for a misused event, model
     or slot, mapped back to the `.uf.tsx` line.

## Consequences

**Positive:**

- Vue users know the macros, and Vue's output keeps them almost verbatim (Appendix A).
- Named-tuple payloads carry their types to every target.
- The compiler sees every declaration statically, which feeds the component manifest (§8.8).
- Layers 1, 2 and 4 work without the content mapper, so consumers are never blocked on it (R3).

**Negative:**

- Under stock tsgo, consumer payloads, model types and slot props are not checked. Layer 1 only
  guarantees that legitimate code raises no false errors.
- Full editor typing waits for the content mapper. It needs TS 7.1 (planned for Nov 24, 2026),
  TypeScript's `--runExternalCode`, and a trusted workspace in VS Code.
- Consumer typing is four mechanisms rather than one, and each needs its own tests.

**Open:**

- Whether a content mapper may claim `.uf.tsx` is settled by M0 spike 6 (ADR-0005, R3).

## Alternatives considered

The plan records C3 as confirmed and lists no alternatives for it. It accepts that the macros
inherit v1's typing problem, and pays for that in §5.6 rather than choosing another API.

- **Macros without a typing plan, as in v1.** That ended in `[attr: string]: any` on every
  component (§2). The layers replace it with targeted index signatures, compiler checks and probe
  tests.
- **Callback and slot props in the signature, React-style.** React's APIs in the source are a
  non-goal, and the authoring APIs are Vue-inspired (§3). The plan does not weigh this option
  further.
