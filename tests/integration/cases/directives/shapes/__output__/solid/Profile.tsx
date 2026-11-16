import { vSelectable } from "./vSelectable";
import { type JSX, Show, createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { isServer } from "solid-js/web";

interface User {
  name: string;
}

const hooks = "data-hooks";
const element = "data-element";

function vMark(getValue: () => string): (element: HTMLElement) => void {
  const hooks_1 = {
    mounted(el: HTMLElement, value: string) {
      el.setAttribute(hooks, value);
      el.setAttribute(element, "mounted");
      return el;
    },
    updated(el: HTMLElement, value: string) {
      const oldValue = "updated";
      el.setAttribute(hooks, `${oldValue} ${value}`);
    },
    unmounted() {},
  };
  let target: HTMLElement | undefined;
  let current = untrack(getValue);
  onMount(() => {
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.mounted(element_1, current), "mounted");
  });
  createEffect(() => {
    const next = getValue();
    if (Object.is(next, current)) return;
    current = next;
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.updated(element_1, next), "updated");
  });
  onCleanup(() => {
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.unmounted(), "unmounted");
  });
  return (element_1) => {
    target = element_1;
  };
}

export default function Profile(props: { class?: string; style?: JSX.CSSProperties }) {
  const [user, setUser] = createSignal<User | null>({ name: "Ada" });
  const [note, setNote] = createSignal("Hello");
  const [label, setLabel] = createSignal<string | number>("Lovelace");
  const [nick, setNick] = createSignal<string | undefined>("Al");
  const [track] = createSignal("Trail");
  const [cleanup] = createSignal<string | null>("Tidy");

  return (
    <section
      class={props.class ? `profile ${props.class}` : "profile"}
      aria-label="Profile"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={user()}>{(user) => <p ref={vMark(() => user().name)}>{user().name}</p>}</Show>
      <Show when={((label) => (typeof label === "string" ? { label } : undefined))(label())}>
        {(narrowed) => <b ref={vMark(() => narrowed().label)}>{narrowed().label}</b>}
      </Show>
      <Show when={nick()}>{(nick) => <i ref={vMark(() => nick())}>{nick()}</i>}</Show>
      <Show when={cleanup()}>
        {(cleanup) => <s ref={vMark(() => cleanup() + track())}>{cleanup()}</s>}
      </Show>
      <textarea
        aria-label="Note"
        value={isServer ? undefined : note()}
        children={isServer ? note() : undefined}
        onInput={(event) => setNote(event.currentTarget.value)}
        ref={(element_1) => {
          textCaret(element_1);
          vMark(() => note())(element_1);
          vSelectable(() => true)(element_1);
        }}
      />
      <button type="button" onClick={() => setUser(user() ? null : { name: "Grace" })}>
        Toggle
      </button>
      <button type="button" onClick={() => setLabel(1)}>
        Count
      </button>
      <button type="button" onClick={() => setNick(undefined)}>
        Forget
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

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
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
