// The order a directive's hooks run in, Vue's (ADR-0099): within one turn, a descendant's before
// its ancestor's, and siblings' in document order, a post-order of the DOM. A target whose own
// order differs (Solid's refs run parent first, Angular's mix) queues each hook in an inline
// helper, which sorts what one turn queued and runs it in a microtask. A detached subtree keeps
// its shape, so an element removed with its descendants still sorts after them.

/** The inline helper that queues a directive's hook, `queueHook(element, () => …)`. */
export function hookQueueCode(name: string, queue: string): string {
  return [
    `const ${queue}: { element: Element; run: () => void }[] = [];`,
    "",
    "/**",
    " * Runs a directive's hook once the turn ends, a descendant's before its ancestor's and",
    " * siblings' in document order, as Vue runs them.",
    " */",
    `function ${name}(element: Element, run: () => void): void {`,
    `  if (!${queue}.length) {`,
    "    queueMicrotask(() => {",
    `      const hooks = ${queue}.splice(0).sort((a, b) => {`,
    "        if (a.element === b.element) return 0;",
    "        if (a.element.contains(b.element)) return 1;",
    "        if (b.element.contains(a.element)) return -1;",
    "        return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING",
    "          ? -1",
    "          : 1;",
    "      });",
    "      for (const hook of hooks) hook.run();",
    "    });",
    "  }",
    `  ${queue}.push({ element, run });`,
    "}",
  ].join("\n");
}
