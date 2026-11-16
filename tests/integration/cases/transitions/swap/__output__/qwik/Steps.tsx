import {
  type CSSProperties,
  type ClassList,
  component$,
  useConstant,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { isServer } from "@qwik.dev/core/build";
import styles from "./Steps.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    const first = useSignal(true);
    const step = useSignal(1);

    const swapState = useConstant((): TransitionState => ({
      ready: false,
      current: first.value ? 0 : 1,
      elements: [],
    }));
    const swapShown = useSignal<number[]>([first.value ? 0 : 1].filter((index) => index >= 0));
    useVisibleTask$(
      ({ track }) => {
        const next = track(() => (first.value ? 0 : 1));
        swapState.ready = true;
        const previous = swapState.current;
        if (next === previous) return;
        swapState.current = next;
        if (next >= 0)
          swapShown.value = [...swapShown.value.filter((index) => index !== next), next];
        const leaving = previous < 0 ? undefined : swapState.elements[previous];
        if (!leaving) {
          swapShown.value = swapShown.value.filter((index) => index !== previous);
          return;
        }
        runTransition(leaving, "swap", "leave", () => {
          swapShown.value = swapShown.value.filter((index) => index !== previous);
        });
      },
      { strategy: "document-ready" },
    );
    const stepState = useConstant((): TransitionState => ({
      ready: false,
      current: step.value === 1 ? 0 : step.value === 2 ? 1 : 2,
      elements: [],
    }));
    const stepShown = useSignal<number[]>(
      [step.value === 1 ? 0 : step.value === 2 ? 1 : 2].filter((index) => index >= 0),
    );
    useVisibleTask$(
      ({ track }) => {
        const next = track(() => (step.value === 1 ? 0 : step.value === 2 ? 1 : 2));
        stepState.ready = true;
        const previous = stepState.current;
        if (next === previous) return;
        stepState.current = next;
        if (next >= 0)
          stepShown.value = [...stepShown.value.filter((index) => index !== next), next];
        const leaving = previous < 0 ? undefined : stepState.elements[previous];
        if (!leaving) {
          stepShown.value = stepShown.value.filter((index) => index !== previous);
          return;
        }
        runTransition(leaving, "step", "leave", () => {
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
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** A transition's state: whether its component has mounted, the branch shown, and its elements. */
interface TransitionState {
  ready: boolean;
  current: number;
  elements: Element[];
}

/**
 * Runs Vue's transition classes of `name` of one phase on `element`, then `done`: `-from` and
 * `-active`, `-to` for `-from` two frames later, and none once the element's own
 * `transitionend` or `animationend` fires, or its longest duration and delay pass.
 */
function runTransition(
  element: Element,
  name: string,
  phase: "enter" | "leave",
  done?: () => void,
): void {
  const from = `${name}-${phase}-from`;
  const active = `${name}-${phase}-active`;
  const to = `${name}-${phase}-to`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = (event?: Event) => {
    if (event && event.target !== element) return;
    clearTimeout(timer);
    element.removeEventListener("transitionend", end);
    element.removeEventListener("animationend", end);
    element.classList.remove(from, active, to);
    done?.();
  };
  element.classList.add(from, active);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
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
 * The ref of a transition's element: it records the element, and runs its enter once the
 * component has mounted, or with `appear`. Qwik calls a ref again when its value changes, and
 * each render makes a new one, so it takes an element once. It calls the element's own ref first.
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
    if (state.ready || appear) runTransition(element, name, "enter");
  };
}
