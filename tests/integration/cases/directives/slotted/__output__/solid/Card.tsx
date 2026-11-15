import Disclosure from "./Disclosure";
import { type JSX, Show, createSignal, onCleanup, onMount, untrack } from "solid-js";

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
  onMount(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current));
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), true);
  });
  return (element) => {
    target = element;
  };
}

export default function Card(props: { class?: string; style?: JSX.CSSProperties }) {
  const [note] = createSignal<{ name: string } | null>({ name: "note" });

  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      aria-label="Card"
      style={props.style}
      {...scopeAttributes(props)}
    >
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
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then
 * a descendant's before its ancestor's and siblings' in document order, one element's in the
 * order they came, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void, leaving = false): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks@1");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void; leaving: boolean }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run, leaving });
    return;
  }
  scope[key] = [{ element, run, leaving }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as
    // StrictMode's, which keeps its place among the rest.
    const first = new Set<{ element: Element; run: () => void; leaving: boolean }>();
    const entered = new Set<Element>();
    for (const hook of hooks) {
      if (!hook.leaving) entered.add(hook.element);
      else if (!entered.has(hook.element)) first.add(hook);
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
    for (const hook of hooks) {
      try {
        hook.run();
      } catch (error) {
        reportError(error);
      }
    }
  });
}
