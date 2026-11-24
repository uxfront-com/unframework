import {
  type TransitionState,
  runTransition,
  stopTransition,
  transition,
} from "./_unframework/transition";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useConstant,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@qwik.dev/core";
import styles from "./Accordion.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  const open = useSignal(true);

  const outerState = useConstant((): TransitionState => ({
    current: open.value ? 0 : -1,
    elements: [],
    entering: [],
  }));
  const outerShown = useSignal<number[]>([open.value ? 0 : -1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (open.value ? 0 : -1));
      const previous = outerState.current;
      if (next === previous) return;
      outerState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(outerState.elements[next]);
        if (!outerShown.value.includes(next)) {
          outerState.entering.push(next);
          outerShown.value = [...outerShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = outerState.entering.indexOf(next);
              if (left >= 0) outerState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : outerState.elements[previous];
      if (!leaving) {
        outerShown.value = outerShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "outer", "leave", () => {
        if (outerState.current !== previous)
          outerShown.value = outerShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );
  const innerState = useConstant((): TransitionState => ({
    current: 0,
    elements: [],
    entering: [],
  }));

  return (
    <section
      aria-label="Shipping"
      data-uf-357b6b1f=""
      class={className}
      style={style}
      {...attributes}
    >
      <button
        type="button"
        aria-expanded={open.value}
        onClick$={() => (open.value = !open.value)}
        data-uf-357b6b1f=""
      >
        Shipping
      </button>
      <>
        {outerShown.value.includes(0) && (
          <div class="panel" data-uf-357b6b1f="" ref={transition(outerState, "outer", 0, false)}>
            <p class="note" data-uf-357b6b1f="" ref={transition(innerState, "inner", 0, false)}>
              Ships in two days.
            </p>
          </div>
        )}
      </>
    </section>
  );
});
