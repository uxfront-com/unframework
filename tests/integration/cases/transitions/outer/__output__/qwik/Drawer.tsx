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
import styles from "./Drawer.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

  const shown = useSignal(true);
  const open = useSignal(true);

  const fadeState = useConstant((): TransitionState => ({
    current: open.value ? 0 : -1,
    elements: [],
    entering: [],
  }));
  const fadeShown = useSignal<number[]>([open.value ? 0 : -1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (open.value ? 0 : -1));
      const previous = fadeState.current;
      if (next === previous) return;
      fadeState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(fadeState.elements[next]);
        if (!fadeShown.value.includes(next)) {
          fadeState.entering.push(next);
          fadeShown.value = [...fadeShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = fadeState.entering.indexOf(next);
              if (left >= 0) fadeState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : fadeState.elements[previous];
      if (!leaving) {
        fadeShown.value = fadeShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "fade", "leave", () => {
        if (fadeState.current !== previous)
          fadeShown.value = fadeShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section
      aria-label="Filters"
      data-uf-54e3e959=""
      class={className}
      style={style}
      {...attributes}
    >
      <button type="button" onClick$={() => (shown.value = !shown.value)} data-uf-54e3e959="">
        Drawer
      </button>
      <button type="button" onClick$={() => (open.value = !open.value)} data-uf-54e3e959="">
        Body
      </button>
      {shown.value ? (
        <>
          {fadeShown.value.includes(0) && (
            <p class="body" data-uf-54e3e959="" ref={transition(fadeState, "fade", 0, false)}>
              Colour, size
            </p>
          )}
        </>
      ) : null}
    </section>
  );
});
