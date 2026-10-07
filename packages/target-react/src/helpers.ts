// The inline helpers of React's emulated capabilities (P7, ADR-0033): each is printed after the
// component that needs it, under a name the output file claims, and named in its capability cell.

/**
 * `event-semantics`: a native listener, where React's synthetic event would not keep the DOM's
 * semantics (ADR-0047). A ref callback calls it with its element and returns what it gives back,
 * which React runs when the element goes (React 19's ref cleanups). Its events are an element's
 * (`HTMLElementEventMap`: lib.dom's global handlers and `ElementEventMap`'s fullscreen events),
 * the map every element of the vocabulary dispatches with.
 */
export function listenHelper(name: string): string {
  return `/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function ${name}<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}`;
}

/**
 * `event-once`: the guard of a listener that runs once (`onClickOnce`). It remembers each
 * element it ran for, as a native listener added with `{ once: true }` is removed from its own
 * element only: in a list, every row's runs once.
 */
export function onceHelper(name: string, useRef: string): string {
  return `/** The guard of a listener that runs once per element, as \`{ once: true }\` makes it. */
function ${name}(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = ${useRef}(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}`;
}

/**
 * `next-tick`: Vue's `nextTick` for one component (ADR-0048). Vue resolves it after its whole
 * flush, in the microtask after the writes: they rendered, the watchers ran, and what they wrote
 * rendered too. The helper asks for a render of its own at the priority of the code that calls
 * it, so React renders it with the writes before it: within the task where they come from a
 * discrete event (a click, a key), which React renders at the microtask checkpoint with its
 * effects. It resolves a request once every effect of a commit that rendered it has run, unless
 * `settled` says the component's effects wrote state React has yet to render (a watcher's write
 * renders in a later task): then it asks for a render of its own, whose commit looks again, as
 * writes that end where they were make React commit nothing. A request made while effects run is never
 * resolved by the commit whose effects are running. The component unmounting resolves every
 * request, as Vue's flush that unmounts it does, unless StrictMode mounts it again at once.
 */
export function nextTickHelper(name: string, hooks: NextTickHooks): string {
  return `/**
 * Vue's \`nextTick\` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and \`settled\` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function ${name}(settled: () => boolean = () => true): () => Promise<void> {
  const pending = ${hooks.useRef}<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = ${hooks.useRef}(0);
  const mounted = ${hooks.useRef}(false);
  const [rendered, render] = ${hooks.useReducer}(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  ${hooks.useEffect}(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  ${hooks.useEffect}(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}`;
}

/** The local names of the React hooks the `nextTick` helper calls. */
export interface NextTickHooks {
  useRef: string;
  useReducer: string;
  useEffect: string;
}
