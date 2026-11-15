// The order a directive's hooks run in, Vue's (ADR-0099): within one turn, every `unmounted`
// first, as Vue removes what a render drops before it mounts what the render adds, then a
// descendant's before its ancestor's, and siblings' in document order, a post-order of the DOM.
// An `unmounted` that follows its own element's `mounted` in the turn, as StrictMode's
// `mounted`, `unmounted` and `mounted` are, keeps its place among the rest, and one element's
// hooks keep the order they were queued in. A
// target whose own order differs (Solid's refs run parent first, Angular mixes the two, React's
// and Qwik's helpers run from effects) queues each hook in an inline helper, which sorts what one
// turn queued and runs it in a microtask. Each output declares the helper, since no output imports
// another's (P7), but they share one queue, kept on `globalThis` under a registered symbol whose
// name carries the queue's version, so hooks from different outputs, a directive module's and a
// component's, sort together. A detached subtree keeps its shape, so an element removed with its
// descendants still sorts after them. A hook that throws is reported, and the rest of its turn
// still runs.

/** The inline helper that queues a directive's hook, `queueHook(element, () => …, leaving)`. */
export function hookQueueCode(name: string): string {
  return [
    "/**",
    " * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then",
    " * a descendant's before its ancestor's and siblings' in document order, one element's in the",
    " * order they came, with the hooks every other output queued.",
    " */",
    `function ${name}(element: Element, run: () => void, leaving = false): void {`,
    '  const key: unique symbol = Symbol.for("unframework.directive-hooks@1");',
    "  const scope = globalThis as typeof globalThis & {",
    "    [key]?: { element: Element; run: () => void; leaving: boolean }[];",
    "  };",
    "  const queued = scope[key];",
    "  if (queued) {",
    "    queued.push({ element, run, leaving });",
    "    return;",
    "  }",
    "  scope[key] = [{ element, run, leaving }];",
    "  queueMicrotask(() => {",
    "    const hooks = scope[key] ?? [];",
    "    scope[key] = undefined;",
    "    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as",
    "    // StrictMode's, which keeps its place among the rest.",
    "    const first = new Set<{ element: Element; run: () => void; leaving: boolean }>();",
    "    const entered = new Set<Element>();",
    "    for (const hook of hooks) {",
    "      if (!hook.leaving) entered.add(hook.element);",
    "      else if (!entered.has(hook.element)) first.add(hook);",
    "    }",
    "    hooks.sort((a, b) => {",
    "      if (first.has(a) !== first.has(b)) return first.has(a) ? -1 : 1;",
    "      if (a.element === b.element) return 0;",
    "      if (a.element.contains(b.element)) return 1;",
    "      if (b.element.contains(a.element)) return -1;",
    "      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING",
    "        ? -1",
    "        : 1;",
    "    });",
    "    for (const hook of hooks) {",
    "      try {",
    "        hook.run();",
    "      } catch (error) {",
    "        reportError(error);",
    "      }",
    "    }",
    "  });",
    "}",
  ].join("\n");
}
