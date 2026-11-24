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
import styles from "./Menu.uf.tsx.css?inline";

export default component$<
  Omit<PropsOf<"nav">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useStyles$(styles);

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
    <nav
      class={["menu", className]}
      aria-label="Account"
      data-uf-e688a71a=""
      style={style}
      {...attributes}
    >
      <button
        type="button"
        aria-expanded={open.value}
        onClick$={() => (open.value = !open.value)}
        data-uf-e688a71a=""
      >
        Account
      </button>
      <>
        {fadeShown.value.includes(0) && (
          <ul class="items" data-uf-e688a71a="" ref={transition(fadeState, "fade", 0, false)}>
            <li data-uf-e688a71a="">Profile</li>
            <li data-uf-e688a71a="">Sign out</li>
          </ul>
        )}
      </>
    </nav>
  );
});
