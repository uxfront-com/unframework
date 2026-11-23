import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";
import Note from "./Note.gts";

const TRACE = "directive-trace";

const vTrace = directive<string, HTMLElement>({
  mounted(el: HTMLElement, value: string) {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
});

export interface TreeSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Tree extends Component<TreeSignature> {
  @tracked shown = true;

  listener1 = () => (this.shown = !this.shown);

  <template><section
      class="tree"
      aria-label="Tree"
      data-name="outer"
      {{vTrace "outer"}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><p data-name="first" {{vTrace "first"}}>First</p><Note />{{#if this.shown}}<div
      class="branch"
      data-name="branch"
      {{vTrace "branch"}}
    ><span data-name="leaf" {{vTrace "leaf"}}>Leaf</span></div>{{else}}<p
      data-name="placeholder"
      {{vTrace "placeholder"}}
    >Placeholder</p>{{/if}}<p data-name="last" {{vTrace "last"}}>Last</p><button
      type="button"
      {{on "click" this.listener1}}
    >Toggle</button></section></template>
}

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

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
