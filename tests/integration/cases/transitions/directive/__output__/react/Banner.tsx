import { vMark } from "./vMark";
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
import "./Banner.uf.tsx.css";

export type BannerAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Banner({ className, style, ...attributes }: BannerAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const markRef = useDirective(vMark, () => "banner");

  return (
    <section
      aria-label="News"
      className={className}
      style={style}
      data-uf-53025c4a=""
      {...attributes}
    >
      <button
        type="button"
        onClick={() => {
          shownRef.current = false;
          setShown(shownRef.current);
        }}
        data-uf-53025c4a=""
      >
        Dismiss
      </button>
      <Transition name="fade">
        {shown ? (
          <p key={0} className="banner" ref={markRef} data-uf-53025c4a="">
            New releases are out.
          </p>
        ) : null}
      </Transition>
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

/** The hooks of a directive, which `useDirective` runs on its elements. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Runs a directive's hooks on each element its ref callback receives, apart: `mounted` once
 * the element is rendered, `updated` after a render that changes the value, and `unmounted`
 * once that element is gone, whichever component renders or removes it. One use may render
 * several elements, as a slot a child renders in a list. The callback only records the element,
 * and its cleanup forgets that one, so a callback written in place keeps the directive.
 */
function useDirective<E extends Element, T>(directive: DirectiveHooks<E, T>, getValue: () => T) {
  const state = useRef<{ getValue: () => T; attached: Set<E>; mounted: Map<E, T> }>({
    getValue,
    attached: new Set(),
    mounted: new Map(),
  });
  const [sync] = useState(() => () => {
    const { attached, mounted } = state.current;
    for (const element of [...mounted.keys()]) {
      if (attached.has(element)) continue;
      mounted.delete(element);
      queueHook(element, () => directive.unmounted?.(element), "unmounted");
    }
    if (!attached.size) return;
    const value = state.current.getValue();
    for (const element of attached) {
      if (!mounted.has(element)) {
        mounted.set(element, value);
        queueHook(element, () => directive.mounted?.(element, value), "mounted");
        continue;
      }
      const previous = mounted.get(element) as T;
      if (Object.is(value, previous)) continue;
      mounted.set(element, value);
      queueHook(element, () => directive.updated?.(element, value, previous), "updated");
    }
  });
  const [ref] = useState(() => (element: E | null) => {
    if (!element) return () => {};
    state.current.attached.add(element);
    queueMicrotask(sync);
    return () => {
      state.current.attached.delete(element);
      queueMicrotask(sync);
    };
  });
  useLayoutEffect(() => {
    state.current.getValue = getValue;
    sync();
  });
  useLayoutEffect(
    () => () => {
      state.current.attached.clear();
      sync();
    },
    [sync],
  );
  return ref;
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
 */
function queueHook(
  element: Element,
  run: () => void,
  hook: "mounted" | "updated" | "unmounted",
): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@2");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; hook: "mounted" | "updated" | "unmounted" }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, hook });
    return;
  }
  scope[key] = [{ element, run, hook }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest. A leaving one moves up together
    // with the element's hooks before it, which keep their order.
    const first = new Set<(typeof hooks)[number]>();
    const entered = new Set<Element>();
    for (const each of hooks) {
      if (each.hook === "mounted") entered.add(each.element);
      if (each.hook !== "unmounted" || entered.has(each.element)) continue;
      for (const earlier of hooks) {
        if (earlier.element === each.element) first.add(earlier);
        if (earlier === each) break;
      }
    }
    hooks.sort((a, b) => {
      if (first.has(a) !== first.has(b)) return first.has(a) ? -1 : 1;
      if (a.element === b.element) return 0;
      if (a.element.contains(b.element)) return 1;
      if (b.element.contains(a.element)) return -1;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    for (const each of hooks) {
      try {
        each.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
