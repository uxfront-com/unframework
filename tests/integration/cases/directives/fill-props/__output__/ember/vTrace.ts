import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export const vTrace = directive<string, HTMLElement>({
  mounted(el: HTMLElement, value: string) {
    const call = `trace mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el: HTMLElement, value: string, oldValue: string) {
    const call = `trace updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = "trace unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
});

/**
 * A directive as a modifier: `mounted` once its element is in the DOM, `updated` after a render
 * that changes its value, and `unmounted` once the element goes, each in Vue's order
 * (`queueHook`). No hook runs on the server.
 */
function directive<T, E extends Element>(hooks: {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}): ModifierLike<{ Element: E; Args: { Positional: [value: T] } }> {
  interface State {
    element?: E;
    value?: T;
  }
  return setModifierManager(
    () => ({
      capabilities: capabilities("3.22"),
      createModifier: (): State => ({}),
      installModifier(
        state: State,
        element: E,
        { positional }: { positional: readonly unknown[] },
      ) {
        const value = positional[0] as T;
        state.element = element;
        state.value = value;
        if (import.meta.env.SSR || !hooks.mounted) return;
        queueHook(element, () => void hooks.mounted?.(element, value), "mounted");
      },
      updateModifier(state: State, { positional }: { positional: readonly unknown[] }) {
        const value = positional[0] as T;
        const oldValue = state.value as T;
        const element = state.element;
        if (Object.is(value, oldValue) || !element) return;
        state.value = value;
        if (!hooks.updated) return;
        queueHook(element, () => void hooks.updated?.(element, value, oldValue), "updated");
      },
      destroyModifier(state: State) {
        const element = state.element;
        if (import.meta.env.SSR || !element || !hooks.unmounted) return;
        queueHook(element, () => void hooks.unmounted?.(element), "unmounted");
      },
    }),
    {},
  ) as unknown as ModifierLike<{ Element: E; Args: { Positional: [value: T] } }>;
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
