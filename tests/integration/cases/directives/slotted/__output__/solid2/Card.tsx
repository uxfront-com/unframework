import Disclosure from "./Disclosure";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit, onCleanup, onSettled, untrack } from "solid-js";

function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onSettled(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
  });
  return (element) => {
    target = element;
  };
}

export default function Card(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [note, setNote] = createState<{ name: string } | null>({ name: "note" });

  return (
    <section class={props.class ? `card ${props.class}` : "card"} aria-label="Card" {...others}>
      <Disclosure>
        <p data-name="body" ref={vTrace(() => "body")}>
          Body
        </p>
        <Show when={note()}>
          {(note) => (
            <p data-name="note" ref={vTrace(() => note().name)}>
              Note
            </p>
          )}
        </Show>
      </Disclosure>
      <button type="button" onClick={() => setNote({ name: "renamed" })}>
        Rename
      </button>
    </section>
  );
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
