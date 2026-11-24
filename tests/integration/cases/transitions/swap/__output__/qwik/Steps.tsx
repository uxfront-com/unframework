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
import styles from "./Steps.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  const first = useSignal(true);
  const step = useSignal(1);

  const swapState = useConstant((): TransitionState => ({
    current: first.value ? 0 : 1,
    elements: [],
    entering: [],
  }));
  const swapShown = useSignal<number[]>([first.value ? 0 : 1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (first.value ? 0 : 1));
      const previous = swapState.current;
      if (next === previous) return;
      swapState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(swapState.elements[next]);
        if (!swapShown.value.includes(next)) {
          swapState.entering.push(next);
          swapShown.value = [...swapShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = swapState.entering.indexOf(next);
              if (left >= 0) swapState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : swapState.elements[previous];
      if (!leaving) {
        swapShown.value = swapShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "swap", "leave", () => {
        if (swapState.current !== previous)
          swapShown.value = swapShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );
  const stepState = useConstant((): TransitionState => ({
    current: step.value === 1 ? 0 : step.value === 2 ? 1 : 2,
    elements: [],
    entering: [],
  }));
  const stepShown = useSignal<number[]>(
    [step.value === 1 ? 0 : step.value === 2 ? 1 : 2].filter((index) => index >= 0),
  );
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (step.value === 1 ? 0 : step.value === 2 ? 1 : 2));
      const previous = stepState.current;
      if (next === previous) return;
      stepState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(stepState.elements[next]);
        if (!stepShown.value.includes(next)) {
          stepState.entering.push(next);
          stepShown.value = [...stepShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = stepState.entering.indexOf(next);
              if (left >= 0) stepState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : stepState.elements[previous];
      if (!leaving) {
        stepShown.value = stepShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "step", "leave", () => {
        if (stepState.current !== previous)
          stepShown.value = stepShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section
      class={["steps", className]}
      aria-label="Checkout"
      data-uf-84fe8ccf=""
      style={style}
      {...attributes}
    >
      <button type="button" onClick$={() => (first.value = !first.value)} data-uf-84fe8ccf="">
        Swap
      </button>
      <>
        {swapShown.value.includes(0) && (
          <p class="card" data-uf-84fe8ccf="" ref={transition(swapState, "swap", 0, false)}>
            Cart
          </p>
        )}
        {swapShown.value.includes(1) && (
          <p class="card" data-uf-84fe8ccf="" ref={transition(swapState, "swap", 1, false)}>
            Payment
          </p>
        )}
      </>
      <button
        type="button"
        onClick$={() => (step.value = (step.value % 3) + 1)}
        data-uf-84fe8ccf=""
      >
        Next
      </button>
      <>
        {stepShown.value.includes(0) && (
          <p class="step" data-uf-84fe8ccf="" ref={transition(stepState, "step", 0, false)}>
            Step one
          </p>
        )}
        {stepShown.value.includes(1) && (
          <p class="step" data-uf-84fe8ccf="" ref={transition(stepState, "step", 1, false)}>
            Step two
          </p>
        )}
        {stepShown.value.includes(2) && (
          <p class="step" data-uf-84fe8ccf="" ref={transition(stepState, "step", 2, false)}>
            Step three
          </p>
        )}
      </>
    </section>
  );
});
