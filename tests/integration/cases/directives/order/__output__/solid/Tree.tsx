import Note from "./Note";
import {
  type ComponentProps,
  type JSX,
  Show,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  untrack,
} from "solid-js";

const TRACE = "directive-trace";

function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onMount(() => {
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

export default function Tree(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [shown, setShown] = createSignal(true);

  return (
    <section
      class={props.class ? `tree ${props.class}` : "tree"}
      aria-label="Tree"
      data-name="outer"
      ref={vTrace(() => "outer")}
      {...others}
    >
      <p data-name="first" ref={vTrace(() => "first")}>
        First
      </p>
      <Note />
      <Show
        when={shown()}
        fallback={
          <p data-name="placeholder" ref={vTrace(() => "placeholder")}>
            Placeholder
          </p>
        }
      >
        <div class="branch" data-name="branch" ref={vTrace(() => "branch")}>
          <span data-name="leaf" ref={vTrace(() => "leaf")}>
            Leaf
          </span>
        </div>
      </Show>
      <p data-name="last" ref={vTrace(() => "last")}>
        Last
      </p>
      <button type="button" onClick={() => setShown(!shown())}>
        Toggle
      </button>
    </section>
  );
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
