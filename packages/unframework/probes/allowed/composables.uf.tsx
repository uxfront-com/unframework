// Components that call composables (ADR-0069): no false errors under stock tsgo.
import { ref } from "unframework";

import Disclosure from "../fixtures/Disclosure.uf.tsx";
import { useControllableState, useToggle } from "../fixtures/useToggle.uf.ts";

export function Composables() {
  const note = ref("");
  const { on, label, toggle } = useToggle(true);
  const { current, set } = useControllableState(
    () => note.value,
    (next) => (note.value = next),
  );

  return (
    <section>
      <button type="button" aria-pressed={on.value} onClick={toggle}>
        {label.value}
      </button>
      <input value={current.value} onKeydown={(event) => event.key === "Escape" && set("")} />
      {/* A component that calls composables is consumed as any other. */}
      <Disclosure summary="More" note={note.value} onEdit={(next) => (note.value = next)}>
        <p>Details</p>
      </Disclosure>
    </section>
  );
}

export function ComposableBlindSpots() {
  const { on } = useToggle(false);
  // Writing a ref a composable returns: its type is a `Ref`. Caught by: compiler (UF2036).
  const reset = () => (on.value = false);
  return (
    <button type="button" onClick={reset}>
      Reset
    </button>
  );
}
