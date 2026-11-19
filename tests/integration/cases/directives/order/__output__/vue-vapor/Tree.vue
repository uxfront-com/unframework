<script setup vapor lang="ts">
import Note from "./Note.vue";
import { type VaporDirective, ref, watchPostEffect } from "vue";

const TRACE = "directive-trace";

const vTrace: VaporDirective<HTMLElement, string> = (element, getValue) => {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
    },
  };
  const current = getValue!();
  let mounted = false;
  watchPostEffect(() => {
    if (mounted) return;
    mounted = true;
    queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  return () => queueHook(element, () => hooks.unmounted(element), "unmounted");
};

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

const shown = ref(true);
</script>

<template>
  <section v-trace="'outer'" class="tree" aria-label="Tree" data-name="outer">
    <p v-trace="'first'" data-name="first">First</p>
    <Note />
    <div v-if="shown" v-trace="'branch'" class="branch" data-name="branch">
      <span v-trace="'leaf'" data-name="leaf">Leaf</span>
    </div>
    <p v-else v-trace="'placeholder'" data-name="placeholder">Placeholder</p>
    <p v-trace="'last'" data-name="last">Last</p>
    <button type="button" @click="shown = !shown">Toggle</button>
  </section>
</template>
