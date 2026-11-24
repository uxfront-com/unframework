import {
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import "./Drawer.uf.tsx.css";

export type DrawerAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Drawer({ className, style, ...attributes }: DrawerAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const [open, setOpen] = useState(true);
  const openRef = useRef(open);

  return (
    <section
      aria-label="Filters"
      className={className}
      style={style}
      data-uf-54e3e959=""
      {...attributes}
    >
      <button
        type="button"
        onClick={() => {
          shownRef.current = !shownRef.current;
          setShown(shownRef.current);
        }}
        data-uf-54e3e959=""
      >
        Drawer
      </button>
      <button
        type="button"
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
        data-uf-54e3e959=""
      >
        Body
      </button>
      {shown ? (
        <Transition name="fade">
          {open ? (
            <p key={0} className="body" data-uf-54e3e959="">
              Colour, size
            </p>
          ) : null}
        </Transition>
      ) : null}
    </section>
  );
}

/** One element a `Transition` renders: its key, its last render and the phase it is in. */
interface TransitionEntry {
  key: string;
  node: ReactElement<{ className?: string; ref?: Ref<Element> }>;
  phase?: "enter" | "leave";
  step: "from" | "to";
  time: number;
}

/** Subscribes to nothing: whether the component renders on a client never changes once it does. */
function subscribeNothing(): () => void {
  return () => {};
}

/**
 * Runs Vue's transition classes of `name` on the element `children` renders, keyed by its
 * branch, as it enters and leaves: `-from` and `-active` first, `-to` for `-from` two frames
 * later, and none once the element's own `transitionend` or `animationend` fires, or its longest
 * duration and delay pass. A leaving element stays, as it last rendered, until its leave ends.
 */
function Transition({
  name,
  appear = false,
  children,
}: {
  name: string;
  appear?: boolean;
  children: ReactElement<{ className?: string; ref?: Ref<Element> }> | null;
}): ReactNode {
  // False on the server and while the client hydrates: only a client mount runs `appear`.
  const client = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const [shown, setShown] = useState(children);
  const [entries, setEntries] = useState<TransitionEntry[]>(() =>
    children
      ? [
          {
            key: String(children.key),
            node: children,
            ...(appear && client ? { phase: "enter" as const } : {}),
            step: "from",
            time: 0,
          },
        ]
      : [],
  );
  const elements = useRef(new Map<string, Element>());
  const [register] = useState(() => (key: string, element: Element | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  });
  if (children !== shown) {
    setShown(children);
    const before = shown === null ? undefined : String(shown.key);
    const after = children === null ? undefined : String(children.key);
    if (before !== after) {
      // The shown element leaves as it last rendered, and the new one enters.
      const next = entries.flatMap((each): TransitionEntry[] => {
        if (each.key === after) return [];
        return each.key === before && each.phase !== "leave" && shown
          ? [{ key: each.key, node: shown, phase: "leave", step: "from", time: 0 }]
          : [each];
      });
      if (children && after !== undefined)
        next.push({ key: after, node: children, phase: "enter", step: "from", time: 0 });
      setEntries(next);
    }
  }
  useLayoutEffect(() => {
    const stops: (() => void)[] = [];
    const settle = (entry: TransitionEntry) =>
      setEntries((list) =>
        entry.phase === "leave"
          ? list.filter((each) => each !== entry)
          : list.map((each) =>
              each === entry ? { key: each.key, node: each.node, step: "from", time: 0 } : each,
            ),
      );
    for (const entry of entries) {
      const element = elements.current.get(entry.key);
      if (!entry.phase || !element) continue;
      if (entry.step === "from") {
        let frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
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
            if (!time) settle(entry);
            else
              setEntries((list) =>
                list.map((each) => (each === entry ? { ...each, step: "to", time } : each)),
              );
          });
        });
        stops.push(() => cancelAnimationFrame(frame));
        continue;
      }
      const end = (event?: Event) => {
        if (event && event.target !== element) return;
        settle(entry);
      };
      element.addEventListener("transitionend", end);
      element.addEventListener("animationend", end);
      const timer = setTimeout(end, entry.time + 1);
      stops.push(() => {
        clearTimeout(timer);
        element.removeEventListener("transitionend", end);
        element.removeEventListener("animationend", end);
      });
    }
    return () => {
      for (const stop of stops) stop();
    };
  }, [entries]);
  return entries.map((entry) => {
    const node = entry.phase === "leave" || !children ? entry.node : children;
    const classes = entry.phase
      ? [`${name}-${entry.phase}-${entry.step}`, `${name}-${entry.phase}-active`]
      : [];
    return (
      <TransitionItem
        key={entry.key}
        id={entry.key}
        node={node}
        className={[node.props.className, ...classes].filter(Boolean).join(" ") || undefined}
        register={register}
      />
    );
  });
}

/** Renders one element of a `Transition` with its classes, its own ref kept beside the transition's. */
function TransitionItem({
  id,
  node,
  className,
  register,
}: {
  id: string;
  node: ReactElement<{ className?: string; ref?: Ref<Element> }>;
  className: string | undefined;
  register: (key: string, element: Element | null) => void;
}): ReactNode {
  const own = node.props.ref;
  const ref = useCallback(
    (element: Element) => {
      register(id, element);
      const detach = attachRef(own, element);
      return () => {
        register(id, null);
        detach();
      };
    },
    [id, own, register],
  );
  return cloneElement(node, { className, ref });
}

/** Gives a ref the element, as React would, and returns what takes it back. */
function attachRef(ref: Ref<Element> | undefined, element: Element): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (ref) ref.current = element;
  return () => {
    if (ref) ref.current = null;
  };
}
