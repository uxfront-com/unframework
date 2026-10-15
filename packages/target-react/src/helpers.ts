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

/**
 * `reactive-context`: a provided ref (ADR-0054). Consumers read a ref's `value`, so the provider
 * passes the state behind a `value` getter, a new object each time the state changes: the
 * context's consumers render again with it. The getter reads the rendered state, never the
 * mirror: React Compiler and `react/refs` reject a ref read during render (L3, L5).
 */
export function refObjectHelper(name: string): string {
  return `/** A provided ref as its consumers read it: a \`value\` getter over the state. */
function ${name}<T>(value: T): { readonly value: T } {
  return {
    get value() {
      return value;
    },
  };
}`;
}

/**
 * `model-array`: a checkbox's `v-model` of an array (ADR-0054), as Vue's `vModelCheckbox`
 * writes it: checked adds the box's value where it is missing, unchecked removes it, each time
 * into a new array.
 */
export function toggleHelper(name: string): string {
  return `/** The array with \`value\` added when \`checked\`, and without it otherwise. */
function ${name}<T>(values: T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked && index === -1) return [...values, value];
  if (!checked && index !== -1) return values.filter((_, at) => at !== index);
  return values;
}`;
}

/** The local names of the React hooks and types the `modelText` helper uses, and of its cast. */
export interface ModelTextNames {
  useState: string;
  ChangeEvent: string;
  looseToNumber: string;
}

/**
 * `model-modifiers`: a text field's `v-model` with its modifiers, and a number or a range input's
 * (ADR-0054), as Vue's `vModelText` binds them. The field shows what the person typed, which
 * `trim` and `number` change before they write it, so the hook keeps the field's text as state of
 * its own and gives back the props of a controlled field (React keeps its `value` attribute in
 * step, ADR-0058). It writes on every edit, or as the field loses focus for `lazy` (where a
 * text field's `change` fires), trims there too, and shows a new state unless the focused field already means it.
 */
export function modelTextHelper(name: string, names: ModelTextNames): string {
  return `/**
 * Binds a text field to state as Vue's \`v-model\` does with its modifiers: it writes on each edit
 * (as the field loses focus when \`lazy\`), trimmed and cast to a number as asked, and shows a new
 * state unless the focused field already means it. Gives back the field's props.
 */
function ${name}<T>(
  value: T,
  write: (value: T) => void,
  options: { lazy?: boolean; trim?: boolean; number?: boolean } = {},
): {
  value: string;
  onChange: (event: ${names.ChangeEvent}<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [text, setText] = ${names.useState}(() => String(value ?? ""));
  const [shown, setShown] = ${names.useState}(value);
  const [focused, setFocused] = ${names.useState}(false);
  const read = (typed: string): T => {
    const trimmed = options.trim ? typed.trim() : typed;
    return (options.number ? ${names.looseToNumber}(trimmed) : trimmed) as T;
  };
  if (!Object.is(shown, value)) {
    setShown(value);
    const current =
      options.number && !/^0\\d/.test(text) ? ${names.looseToNumber}(text) : text;
    // The focused field keeps what the person typed where it already means the state.
    const kept =
      current === (value ?? "") || (focused && options.trim && text.trim() === (value ?? ""));
    if (!kept) setText(String(value ?? ""));
  }
  return {
    value: text,
    onChange: (event: ${names.ChangeEvent}<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(event.target.value);
      if (!options.lazy) write(read(event.target.value));
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      // The native \`change\` of a text field: it fires as the field loses focus.
      if (options.trim) setText(text.trim());
      if (options.lazy) write(read(text));
    },
  };
}

/** Vue's \`looseToNumber\`: the number a text starts with, or the text where it starts with none. */
function ${names.looseToNumber}(text: string): number | string {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}`;
}
