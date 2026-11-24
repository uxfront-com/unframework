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
import { isServer } from "@qwik.dev/core/build";
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

/**
 * A transition's state: the branch shown, each branch's element, and the branches a change of the
 * branch shown adds, which enter. Qwik serialises it, so it holds no function.
 */
interface TransitionState {
  current: number;
  elements: Element[];
  entering: number[];
}

/** What stops the phase each element runs now, which its next phase stops first. */
const transitionStops = new WeakMap<Element, () => void>();

/** Stops the phase an element runs, if any, with its classes and without its `done`. */
function stopTransition(element: Element | undefined): void {
  if (element) transitionStops.get(element)?.();
}

/**
 * Runs Vue's transition classes of `name` of one phase on `element`, then `done`: `-from` and
 * `-active`, `-to` for `-from` two frames later, and none once the element's own
 * `transitionend` or `animationend` fires, or its longest duration and delay pass. A phase the
 * element still runs stops first.
 */
function runTransition(
  element: Element,
  name: string,
  phase: "enter" | "leave",
  done?: () => void,
): void {
  transitionStops.get(element)?.();
  const from = `${name}-${phase}-from`;
  const active = `${name}-${phase}-active`;
  const to = `${name}-${phase}-to`;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    element.removeEventListener("transitionend", end);
    element.removeEventListener("animationend", end);
    element.classList.remove(from, active, to);
    if (transitionStops.get(element) === stop) transitionStops.delete(element);
  };
  transitionStops.set(element, stop);
  const end = (event?: Event) => {
    if (event && event.target !== element) return;
    stop();
    done?.();
  };
  element.classList.add(from, active);
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      element.classList.remove(from);
      element.classList.add(to);
      const style = getComputedStyle(element);
      const longest = (delays: string, durations: string) => {
        const each = (list: string) =>
          list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(
          0,
          ...each(durations).map(
            (duration, index) => duration + (delay[index % delay.length] ?? 0),
          ),
        );
      };
      const time = Math.max(
        longest(style.transitionDelay, style.transitionDuration),
        longest(style.animationDelay, style.animationDuration),
      );
      if (!time) {
        end();
        return;
      }
      element.addEventListener("transitionend", end);
      element.addEventListener("animationend", end);
      timer = setTimeout(end, time + 1);
    });
  });
}

/**
 * The ref of a transition's element: it records the element, and runs its enter when a change of
 * the branch shown added it, or with `appear`, as the transition first mounts. An element that
 * a condition around the transition shows again enters only with `appear`, as on Vue. Qwik calls
 * a ref again when its value changes, and each render makes a new one, so it takes an element
 * once. It calls the element's own ref first.
 */
function transition(
  state: TransitionState,
  name: string,
  index: number,
  appear: boolean,
  own?: ((element: Element) => void) | { value: Element | undefined },
): (element: Element) => void {
  return (element) => {
    if (typeof own === "function") own(element);
    else if (own) own.value = element;
    // Qwik's server render calls a ref too, with no DOM: the server renders the settled child.
    if (isServer) return;
    if (state.elements[index] === element) return;
    state.elements[index] = element;
    const entering = state.entering.indexOf(index);
    if (entering >= 0) state.entering.splice(entering, 1);
    if (entering >= 0 || appear) runTransition(element, name, "enter");
  };
}
