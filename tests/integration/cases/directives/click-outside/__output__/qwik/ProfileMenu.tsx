import { vClickOutside } from "./vClickOutside";
import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface ProfileMenuEvents {
  onClosed$?: QRL<() => void>;
}

export default component$<ProfileMenuEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onClosed$, class: className, style, ...attributes }) => {
    const open = useSignal(false);

    const close = $(() => {
      if (!open.value) return;
      open.value = false;
      onClosed$?.();
    });

    const clickOutsideElement = useSignal<DirectiveElement<typeof vClickOutside>>();

    useVisibleTask$(
      ({ track, cleanup }) => {
        const element = track(clickOutsideElement);
        if (element)
          cleanup(
            runDirective(
              vClickOutside,
              element,
              track(() => close),
            ),
          );
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["profile-menu", className]}
        aria-label="Profile"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <div class="menu" ref={clickOutsideElement}>
          <button
            type="button"
            aria-expanded={open.value}
            onClick$={() => (open.value = !open.value)}
          >
            Account
          </button>
          {open.value ? (
            <ul aria-label="Account actions">
              <li>
                <button type="button">Settings</button>
              </li>
              <li>
                <button type="button">Sign out</button>
              </li>
            </ul>
          ) : null}
        </div>
        <p>Outside the menu</p>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** The hooks of a directive, which `runDirective` runs on its element. */
interface DirectiveHooks<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}

/**
 * Each directive's elements: the value each last received, whether `mounted` ran, how many runs
 * took it up, and the watch on its place in the document.
 */
const directiveStates = new WeakMap<
  object,
  WeakMap<
    Element,
    { value: unknown; mounted: boolean; runs: number; observer: MutationObserver; sync: () => void }
  >
>();

/**
 * Runs a directive's hooks on its element: `mounted` once the element is in the document,
 * `updated` for a value that changed while it is, and `unmounted` once it leaves, which
 * projected content may do and come back. The stop it returns, called when the element's owner
 * goes, unmounts the element a microtask later, unless a later run took it up.
 */
function runDirective<E extends Element, T>(
  directive: DirectiveHooks<E, T>,
  element: E,
  value: T,
): () => void {
  let own = directiveStates.get(directive);
  if (!own) {
    own = new WeakMap();
    directiveStates.set(directive, own);
  }
  const elements = own;
  let state = elements.get(element);
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) queueHook(element, () => directive.updated?.(element, value, previous));
    }
  } else {
    const sync = () => {
      const current = elements.get(element);
      if (!current || current.mounted === element.isConnected) return;
      current.mounted = element.isConnected;
      if (current.mounted) {
        const mounted = current.value as T;
        queueHook(element, () => directive.mounted?.(element, mounted));
      } else {
        queueHook(element, () => directive.unmounted?.(element));
      }
    };
    state = { value, mounted: false, runs: 0, observer: new MutationObserver(sync), sync };
    state.observer.observe(document, { childList: true, subtree: true });
    elements.set(element, state);
  }
  state.sync();
  const taken = state;
  const runs = taken.runs;
  return () => {
    queueMicrotask(() => {
      if (elements.get(element) !== taken || taken.runs !== runs) return;
      taken.observer.disconnect();
      elements.delete(element);
      if (taken.mounted) queueHook(element, () => directive.unmounted?.(element));
    });
  };
}

/** The element a directive's hooks take. */
type DirectiveElement<D> = D extends DirectiveHooks<infer E extends Element, never> ? E : never;

/**
 * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and
 * siblings' in document order, as Vue runs them, with the hooks every other output queued.
 */
function queueHook(element: Element, run: () => void): void {
  const key: unique symbol = Symbol.for("unframework.directive-hooks");
  const scope = globalThis as typeof globalThis & {
    [key]?: { element: Element; run: () => void }[];
  };
  const queued = scope[key];
  if (queued) {
    queued.push({ element, run });
    return;
  }
  scope[key] = [{ element, run }];
  queueMicrotask(() => {
    const hooks = scope[key] ?? [];
    scope[key] = undefined;
    hooks.sort((a, b) => {
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
