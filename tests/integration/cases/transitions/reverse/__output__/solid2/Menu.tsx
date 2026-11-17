import { type JSX, isServer } from "@solidjs/web";
import {
  Show,
  children,
  createEffect,
  createSignal,
  getObserver,
  isHydrating,
  onCleanup,
  untrack,
} from "solid-js";
import "./Menu.uf.tsx.css";

export default function Menu(props: { class?: string; style?: JSX.CSSProperties }) {
  const [open, setOpen] = createState(true);
  const [refreshes, setRefreshes] = createState(0);

  function refresh() {
    setRefreshes(refreshes() + 1);
    setOpen(false);
    setTimeout(() => {
      setOpen(true);
    }, 80);
  }

  return (
    <nav
      class={props.class ? `menu ${props.class}` : "menu"}
      aria-label="Account"
      data-uf-e688a71a=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={refresh}
        data-uf-e688a71a=""
      >
        Refresh
      </button>
      <p role="status" data-uf-e688a71a="">
        Refreshes: {refreshes()}
      </p>
      <Transition name="fade">
        <Show when={open()}>
          <ul class="items" data-uf-e688a71a="">
            <li data-uf-e688a71a="">Profile</li>
          </ul>
        </Show>
      </Transition>
    </nav>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
