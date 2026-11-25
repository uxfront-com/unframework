// The order a directive's hooks run in, Vue's (ADR-0099): within one turn, every `unmounted`
// first, as Vue removes what a render drops before it mounts what the render adds, then a
// descendant's before its ancestor's, and siblings' in document order, a post-order of the DOM.
// An `unmounted` that follows its own element's `mounted` in the turn, as StrictMode's
// `mounted`, `unmounted` and `mounted` are, keeps its place among the rest, and one element's
// hooks keep the order they were queued in. A
// target whose own order differs (Solid's refs run parent first, Angular mixes the two, React's
// and Qwik's helpers run from effects) queues each hook in a helper, which sorts what one turn
// queued and runs it in a microtask. A target may share the helper in its tree's `_unframework/`
// or print it inline (ADR-0121). Either way, separately compiled outputs still sort their hooks
// together, a directive module from one package and a component from another, so every copy of
// the helper shares one queue, kept on `globalThis` under a registered symbol whose name carries
// the queue's version. A detached subtree keeps its shape, so an element removed with its
// descendants still sorts after them. A hook that throws is reported, and the rest of its turn
// still runs.

/** The helper that queues a directive's hook, `queueHook(element, () => …, "mounted")`. */
export function hookQueueCode(name: string): string {
	return [
		"/**",
		" * Runs a directive's hook once the turn ends, as Vue runs them: every `unmounted` first, then",
		" * a descendant's before its ancestor's and siblings' in document order, one element's in the",
		" * order they came, with the hooks every other output queued.",
		" */",
		`function ${name}(`,
		"  element: Element,",
		"  run: () => void,",
		'  hook: "mounted" | "updated" | "unmounted",',
		"): void {",
		'  const key: unique symbol = Symbol.for("unframework.directive-hooks@2");',
		"  const scope = globalThis as typeof globalThis & {",
		'    [key]?: { element: Element; run: () => void; hook: "mounted" | "updated" | "unmounted" }[];',
		"  };",
		"  const queued = scope[key];",
		"  if (queued) {",
		"    queued.push({ element, run, hook });",
		"    return;",
		"  }",
		"  scope[key] = [{ element, run, hook }];",
		"  queueMicrotask(() => {",
		"    const hooks = scope[key] ?? [];",
		"    scope[key] = undefined;",
		"    // Every `unmounted` runs first, but one after its own element's `mounted` this turn, as",
		"    // StrictMode's, which keeps its place among the rest. A leaving one moves up together",
		"    // with the element's hooks before it, which keep their order.",
		"    const first = new Set<(typeof hooks)[number]>();",
		"    const entered = new Set<Element>();",
		"    for (const each of hooks) {",
		'      if (each.hook === "mounted") entered.add(each.element);',
		'      if (each.hook !== "unmounted" || entered.has(each.element)) continue;',
		"      for (const earlier of hooks) {",
		"        if (earlier.element === each.element) first.add(earlier);",
		"        if (earlier === each) break;",
		"      }",
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
		"    for (const each of hooks) {",
		"      try {",
		"        each.run();",
		"      } catch (error) {",
		"        reportError(error);",
		"      }",
		"    }",
		"  });",
		"}",
	].join("\n");
}
