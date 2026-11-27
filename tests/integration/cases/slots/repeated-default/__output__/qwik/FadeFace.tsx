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
  Slot,
  component$,
  useConstant,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@qwik.dev/core";
import styles from "./FadeFace.uf.tsx.css?inline";

export default component$<
  { bold: boolean } & Omit<PropsOf<"div">, "bold" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ bold, class: className, style, ...attributes }) => {
  useStyles$(styles);

  const faceState = useConstant((): TransitionState => ({
    current: bold ? 0 : 1,
    elements: [],
    entering: [],
  }));
  const faceShown = useSignal<number[]>([bold ? 0 : 1].filter((index) => index >= 0));
  useVisibleTask$(
    ({ track }) => {
      const next = track(() => (bold ? 0 : 1));
      const previous = faceState.current;
      if (next === previous) return;
      faceState.current = next;
      if (next >= 0) {
        // Shown again while it leaves: its leave stops, and it stays as it is.
        stopTransition(faceState.elements[next]);
        if (!faceShown.value.includes(next)) {
          faceState.entering.push(next);
          faceShown.value = [...faceShown.value, next];
          // Qwik renders the branch within the frame, unless a condition around the transition
          // hides it: then the mark goes, so the element it shows later enters only with appear.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const left = faceState.entering.indexOf(next);
              if (left >= 0) faceState.entering.splice(left, 1);
            }),
          );
        }
      }
      const leaving = previous < 0 ? undefined : faceState.elements[previous];
      if (!leaving) {
        faceShown.value = faceShown.value.filter((index) => index !== previous);
        return;
      }
      runTransition(leaving, "face", "leave", () => {
        if (faceState.current !== previous)
          faceShown.value = faceShown.value.filter((index) => index !== previous);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <div class={["fade-face", className]} data-uf-c9301a2a="" style={style} {...attributes}>
      <>
        {faceShown.value.includes(0) && (
          <b class="face" data-uf-c9301a2a="" ref={transition(faceState, "face", 0, false)}>
            <Slot />
          </b>
        )}
        {faceShown.value.includes(1) && (
          <i class="face" data-uf-c9301a2a="" ref={transition(faceState, "face", 1, false)}>
            <Slot />
          </i>
        )}
      </>
    </div>
  );
});
