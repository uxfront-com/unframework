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
import styles from "./Panel.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  const open = useSignal(false);

  const vState = useConstant((): TransitionState => ({
    current: open.value ? 0 : -1,
    elements: [],
    entering: [],
  }));
  const vShown = useSignal<number[]>([open.value ? 0 : -1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (open.value ? 0 : -1));
      const previous = vState.current;
      if (next === previous) return;
      vState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(vState.elements[next]);
        if (!vShown.value.includes(next)) {
          vState.entering.push(next);
          vShown.value = [...vShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = vState.entering.indexOf(next);
              if (left >= 0) vState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : vState.elements[previous];
      if (!leaving) {
        vShown.value = vShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "v", "leave", () => {
        if (vState.current !== previous)
          vShown.value = vShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section
      class={["panel", className]}
      aria-label="Delivery"
      data-uf-eab7eeb4=""
      style={style}
      {...attributes}
    >
      <button
        type="button"
        aria-expanded={open.value}
        onClick$={() => (open.value = !open.value)}
        data-uf-eab7eeb4=""
      >
        Details
      </button>
      <>
        {vShown.value.includes(0) && (
          <p class="details" data-uf-eab7eeb4="" ref={transition(vState, "v", 0, false)}>
            Ships in two days.
          </p>
        )}
      </>
    </section>
  );
});
