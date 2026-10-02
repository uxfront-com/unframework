# ADR-0001: Components are setup-once functions in JSX

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §11 C1; §1, §2, §3, §4.1, §4.2, §4.5, §4.6, §5.5, §6, R1, R4, Appendices A and B

## Context

One source file compiles to seven frameworks. Its shape decides what the compiler can analyse, what
type-checkers and editors understand, and what models write fluently (G4, G5).

- v1 wrapped components in `defineComponent(() => …)` and had three channels for props alone (P3,
  Appendix B).
- TypeScript 7.0 ships no in-process API. A source that stock tsgo can check needs no custom
  checker (§5.5).
- The authoring APIs are Vue-inspired. React's and Solid's APIs in the source are a non-goal: React
  is a target, not the authoring model (§3).
- Of the seven targets, only React re-runs the component function on every render (§6, R1).

## Decision

A component is an exported PascalCase function whose last statement returns JSX.

- **Props** are the first parameter, with a type annotation. Destructured props stay reactive, as
  in Vue 3.5. `(props: ButtonProps)` is accepted when nothing has a default.
- **The body is the setup.** It runs once per instance on every target (§4.5).
- **The returned JSX is the template** (ADR-0002).
- Each exported component compiles to its own file for every target. A non-exported component is
  local to its file, and still becomes a sibling file in each output.
- Macros and reactive APIs are called at the top level of the body, never inside a condition, a
  loop or a nested function. Their type arguments and option objects are static.
- Locals keep their source order, and every identifier is resolved by scope.

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

## Consequences

**Positive:**

- The source is ordinary TSX. tsgo type-checks component bodies, macro return values and consumer
  props directly, and any TypeScript editor understands it from day one (§5.5, §8.7).
- Props in the signature are checked for every consumer by stock tsgo, with no extra tooling
  (§5.6).
- Setup-once matches how Vue, Svelte, Solid, Angular and Qwik run a component.
- Setup items keep source order in the IR, which fixes v1's TDZ bugs (INK-12) and its rejection of
  non-function locals (INK0121) (§2, §5.3).
- v1 sources are TSX too, so porting them is a codemod (Appendix B, M10).

**Negative:**

- React re-runs the body on every render. Its output must keep setup-once snapshots,
  read-after-write and batching correct with local shadows and mirror refs, driven by escape
  analysis (R1, §4.5). Correctness beats idiom there.
- A plain `const` that reads a reactive value is evaluated once on every target. The compiler warns
  and offers `computed` as the fix.
- Angular sets inputs after construction, so a prop read in setup has to be read after inputs are
  set, not in a field initialiser (Appendix A, the `state/props-seed-state` case).
- JSX is more expressive than a template. JSX outside the returned tree and early or conditional
  returns are diagnostics (§4.6, R4).
- Events, models and slots do not fit in the signature, which leaves a consumer-typing gap
  (ADR-0003).

## Alternatives considered

The plan records C1 as confirmed and lists no alternatives for it. These are the options its text
argues against:

- **v1's `defineComponent(() => …)` with `defineProps`.** It needed three channels for props, which
  P3 exists to prevent. A typed signature is one channel, and stock tsgo checks it for consumers.
- **A React-style component with hooks.** React's APIs in the source are a non-goal (§3). React's
  re-render model is the exception among the targets (R1), so it is handled in React's output
  rather than imposed on the source.
- **A Vue single-file component as the source.** It is not ordinary TSX: checking it needs vue-tsc,
  which still needs TypeScript 6 (§5.5, R8). The plan wants a syntax that tsgo checks directly and
  that models already write fluently (§1, G4).
