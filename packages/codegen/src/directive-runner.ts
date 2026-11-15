// A directive's hooks where the framework gives no lifecycle that follows the element (ADR-0099).
// Angular creates a component's projected content with the component, before its child puts it
// in the document, and keeps it while the child takes it out and back; Qwik sets a signal ref
// once, when it creates the element, which may be before its slot projects it. So the element's
// place in the document decides: `mounted` once it is in, `updated` for a value that changed
// (`Object.is`) while it is, and `unmounted` once it leaves, which projected content may do and
// come back. A `MutationObserver` watches the document for that. Each hook goes through the
// queue (`hook-queue.ts`), which runs them in Vue's order.

/** The names the runner's code declares, and the queue's it calls. */
export interface DirectiveRunnerNames {
  /** `runDirective`. */
  run: string;
  /** `DirectiveHooks`, the hooks' type. */
  hooks: string;
  /** `directiveStates`, each directive's elements. */
  states: string;
  /** `queueHook`, which the output declares beside it. */
  queue: string;
}

/**
 * The runner's declarations: the hooks' type, the state of each directive's elements and
 * `runDirective`, which a caller calls whenever the element or the value may have changed, and
 * whose returned stop it calls when the element's owner goes.
 */
export function directiveRunnerCode(names: DirectiveRunnerNames): string[] {
  const { run, hooks, states, queue } = names;
  return [
    `/** The hooks of a directive, which \`${run}\` runs on its element. */
interface ${hooks}<E extends Element, T> {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}`,
    `/**
 * Each directive's elements: the value each last received, whether \`mounted\` ran, how many runs
 * took it up, and the watch on its place in the document.
 */
const ${states} = new WeakMap<
  object,
  WeakMap<
    Element,
    { value: unknown; mounted: boolean; runs: number; observer: MutationObserver; sync: () => void }
  >
>();`,
    `/**
 * Runs a directive's hooks on its element: \`mounted\` once the element is in the document,
 * \`updated\` for a value that changed while it is, and \`unmounted\` once it leaves, which
 * projected content may do and come back. The stop it returns, called when the element's owner
 * goes, unmounts the element a microtask later, unless a later run took it up.
 */
function ${run}<E extends Element, T>(
  directive: ${hooks}<E, T>,
  element: E,
  value: T,
): () => void {
  let own = ${states}.get(directive);
  if (!own) {
    own = new WeakMap();
    ${states}.set(directive, own);
  }
  const elements = own;
  let state = elements.get(element);
  if (state) {
    state.runs += 1;
    if (!Object.is(value, state.value)) {
      const previous = state.value as T;
      state.value = value;
      if (state.mounted) ${queue}(element, () => directive.updated?.(element, value, previous));
    }
  } else {
    const sync = () => {
      const current = elements.get(element);
      if (!current || current.mounted === element.isConnected) return;
      current.mounted = element.isConnected;
      if (current.mounted) {
        const mounted = current.value as T;
        ${queue}(element, () => directive.mounted?.(element, mounted));
      } else {
        ${queue}(element, () => directive.unmounted?.(element));
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
      if (taken.mounted) ${queue}(element, () => directive.unmounted?.(element));
    });
  };
}`,
  ];
}
