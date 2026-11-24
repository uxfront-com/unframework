import {
  type ComponentProps,
  type JSX,
  Show,
  children,
  createComputed,
  createSignal,
  onCleanup,
  sharedConfig,
  splitProps,
  untrack,
} from "solid-js";
import { isServer } from "solid-js/web";
import "./Menu.uf.tsx.css";

export default function Menu(
  props: Omit<ComponentProps<"nav">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [open, setOpen] = createSignal(true);
  const [refreshes, setRefreshes] = createSignal(0);

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
      {...others}
    >
      <button type="button" aria-expanded={open()} onClick={refresh} data-uf-e688a71a="">
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

/** Runs Vue's transition classes of `name` on the element `children` renders as it enters and leaves. */
function Transition(props: { name: string; appear?: boolean; children: JSX.Element }): JSX.Element {
  // The server renders the child as it is, and resolves it nowhere else, so it renders it once.
  const resolved = children(() => (isServer ? undefined : props.children));
  const [kept, setKept] = createSignal<Element[]>([]);
  const stops = new Set<() => void>();
  onCleanup(() => {
    for (const stop of stops) stop();
  });
  const run = (element: Element, phase: "enter" | "leave", done?: () => void) => {
    const from = `${props.name}-${phase}-from`;
    const active = `${props.name}-${phase}-active`;
    const to = `${props.name}-${phase}-to`;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stops.delete(stop);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener("transitionend", end);
      element.removeEventListener("animationend", end);
      element.classList.remove(from, active, to);
    };
    const end = (event?: Event) => {
      if (event && event.target !== element) return;
      stop();
      done?.();
    };
    stops.add(stop);
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
  };
  let current: Element | undefined;
  let first = true;
  const hydrating = Boolean(sharedConfig.context);
  createComputed(() => {
    // The server resolves nothing here, and has no `Element`.
    if (isServer) return;
    const value = resolved();
    const next = value instanceof Element ? value : undefined;
    untrack(() => {
      const initial = first;
      first = false;
      if (next === current) return;
      const previous = current;
      current = next;
      const entering = next !== undefined && (initial ? Boolean(props.appear) && !hydrating : true);
      if (previous) {
        run(previous, "leave", () => setKept((list) => list.filter((each) => each !== previous)));
      }
      setKept((list) => [...list.filter((each) => each !== next), ...(next ? [next] : [])]);
      if (next && entering) run(next, "enter");
    });
  });
  return <>{isServer ? props.children : kept()}</>;
}
