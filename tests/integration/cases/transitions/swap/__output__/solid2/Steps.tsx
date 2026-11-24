import { type ComponentProps, type JSX, isServer } from "@solidjs/web";
import {
  Match,
  Show,
  Switch,
  children,
  createEffect,
  createSignal,
  getObserver,
  isHydrating,
  omit,
  onCleanup,
  untrack,
} from "solid-js";
import "./Steps.uf.tsx.css";

export default function Steps(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [first, setFirst] = createState(true);
  const [step, setStep] = createState(1);

  return (
    <section
      class={props.class ? `steps ${props.class}` : "steps"}
      aria-label="Checkout"
      data-uf-84fe8ccf=""
      {...others}
    >
      <button type="button" onClick={() => setFirst(!first())} data-uf-84fe8ccf="">
        Swap
      </button>
      <Transition name="swap">
        <Show
          when={first()}
          fallback={
            <p class="card" data-uf-84fe8ccf="">
              Payment
            </p>
          }
        >
          <p class="card" data-uf-84fe8ccf="">
            Cart
          </p>
        </Show>
      </Transition>
      <button type="button" onClick={() => setStep((step() % 3) + 1)} data-uf-84fe8ccf="">
        Next
      </button>
      <Transition name="step">
        <Switch
          fallback={
            <p class="step" data-uf-84fe8ccf="">
              Step three
            </p>
          }
        >
          <Match when={step() === 1}>
            <p class="step" data-uf-84fe8ccf="">
              Step one
            </p>
          </Match>
          <Match when={step() === 2}>
            <p class="step" data-uf-84fe8ccf="">
              Step two
            </p>
          </Match>
        </Switch>
      </Transition>
    </section>
  );
}

/** Runs Vue's transition classes of `name` on the element `children` renders as it enters and leaves. */
function Transition(props: { name: string; appear?: boolean; children: JSX.Element }): JSX.Element {
  // Resolved on the server too, which renders it as it is: the child takes the same hydration
  // keys on both sides.
  const resolved = children(() => props.children);
  const element = (value: unknown) => (!isServer && value instanceof Element ? value : undefined);
  // The first element is kept at once, so a hydrating client renders the server's.
  let current = element(untrack(resolved));
  const [kept, setKept] = createSignal<Element[]>(current ? [current] : [], { ownedWrite: true });
  const hydrating = isHydrating();
  const stops = new Set<() => void>();
  onCleanup(() => {
    for (const stop of stops) stop();
  });
  const run = (target: Element, phase: "enter" | "leave", done?: () => void) => {
    const from = `${props.name}-${phase}-from`;
    const active = `${props.name}-${phase}-active`;
    const to = `${props.name}-${phase}-to`;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stops.delete(stop);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      target.removeEventListener("transitionend", end);
      target.removeEventListener("animationend", end);
      target.classList.remove(from, active, to);
    };
    const end = (event?: Event) => {
      if (event && event.target !== target) return;
      stop();
      done?.();
    };
    stops.add(stop);
    target.classList.add(from, active);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        target.classList.remove(from);
        target.classList.add(to);
        const style = getComputedStyle(target);
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
        target.addEventListener("transitionend", end);
        target.addEventListener("animationend", end);
        timer = setTimeout(end, time + 1);
      });
    });
  };
  let first = true;
  createEffect(
    () => element(resolved()),
    (next) => {
      const initial = first;
      first = false;
      if (initial) {
        if (next && props.appear && !hydrating) run(next, "enter");
        return;
      }
      if (next === current) return;
      const previous = current;
      current = next;
      if (previous) {
        run(previous, "leave", () => setKept((list) => list.filter((each) => each !== previous)));
      }
      setKept((list) => [...list.filter((each) => each !== next), ...(next ? [next] : [])]);
      if (next) run(next, "enter");
    },
  );
  return <>{isServer ? resolved() : kept()}</>;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
