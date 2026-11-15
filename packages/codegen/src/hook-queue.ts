// The order a directive's hooks run in, Vue's (ADR-0099): within one turn, a descendant's before
// its ancestor's, and siblings' in document order, a post-order of the DOM. A target whose own
// order differs (Solid's refs run parent first, Angular mixes the two, React's and Qwik's helpers
// run from effects) queues each hook in an inline helper, which sorts what one turn queued and
// runs it in a microtask. Each output declares the helper, since no output imports another's
// (P7), but they share one queue, kept on `globalThis` under a registered symbol, so hooks from
// different outputs, a directive module's and a component's, sort together. A detached subtree
// keeps its shape, so an element removed with its descendants still sorts after them. A hook
// that throws is reported, and the rest of its turn still runs.

/** The inline helper that queues a directive's hook, `queueHook(element, () => …)`. */
export function hookQueueCode(name: string): string {
  return [
    "/**",
    " * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and",
    " * siblings' in document order, as Vue runs them, with the hooks every other output queued.",
    " */",
    `function ${name}(element: Element, run: () => void): void {`,
    '  const key: unique symbol = Symbol.for("unframework.directive-hooks");',
    "  const scope = globalThis as typeof globalThis & {",
    "    [key]?: { element: Element; run: () => void }[];",
    "  };",
    "  const queued = scope[key];",
    "  if (queued) {",
    "    queued.push({ element, run });",
    "    return;",
    "  }",
    "  scope[key] = [{ element, run }];",
    "  queueMicrotask(() => {",
    "    const hooks = scope[key] ?? [];",
    "    scope[key] = undefined;",
    "    hooks.sort((a, b) => {",
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
