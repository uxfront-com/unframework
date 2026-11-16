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
import styles from "./Drawer.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
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
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
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
