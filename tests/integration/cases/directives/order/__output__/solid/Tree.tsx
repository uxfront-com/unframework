import { type JSX, Show, createSignal, onCleanup, onMount, untrack } from "solid-js";

const TRACE = "directive-trace";

function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string): void {
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
    },
    unmounted(el: HTMLElement): void {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
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
    if (element) queueHook(element, () => hooks.unmounted(element));
  });
  return (element) => {
    target = element;
  };
}

export default function Tree(props: { class?: string; style?: JSX.CSSProperties }) {
  const [shown, setShown] = createSignal(true);

  return (
    <section
      class={props.class ? `tree ${props.class}` : "tree"}
      aria-label="Tree"
      data-name="outer"
      ref={vTrace(() => "outer")}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p data-name="first" ref={vTrace(() => "first")}>
        First
      </p>
      <Show when={shown()}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

const queuedHooks: { element: Element; run: () => void }[] = [];

/**
 * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and
 * siblings' in document order, as Vue runs them.
 */
function queueHook(element: Element, run: () => void): void {
  if (!queuedHooks.length) {
    queueMicrotask(() => {
      const hooks = queuedHooks.splice(0).sort((a, b) => {
        if (a.element === b.element) return 0;
        if (a.element.contains(b.element)) return 1;
        if (b.element.contains(a.element)) return -1;
        return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      });
      for (const hook of hooks) hook.run();
    });
  }
  queuedHooks.push({ element, run });
}
