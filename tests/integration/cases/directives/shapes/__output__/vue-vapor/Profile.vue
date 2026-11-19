<script setup vapor lang="ts">
import { vSelectable } from "./vSelectable";
import { type VaporDirective, ref, shallowRef, watch, watchPostEffect } from "vue";

interface User {
  name: string;
}

const hooks = "data-hooks";
const element = "data-element";

const vMark: VaporDirective<HTMLElement, string> = (element_1, getValue) => {
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
  let current = getValue!();
  let mounted = false;
  watchPostEffect(() => {
    if (mounted) return;
    mounted = true;
    queueHook(element_1, () => hooks_1.mounted(element_1, current), "mounted");
  });
  watch(
    getValue!,
    (next) => {
      if (Object.is(next, current)) return;
      current = next;
      queueHook(element_1, () => hooks_1.updated(element_1, next), "updated");
    },
    { flush: "post" },
  );
  return () => queueHook(element_1, () => hooks_1.unmounted(), "unmounted");
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

const user = shallowRef<User | null>({ name: "Ada" });
const note = ref("Hello");
const label = ref<string | number>("Lovelace");
const nick = ref<string | undefined>("Al");
const track = ref("Trail");
const cleanup = ref<string | null>("Tidy");

const vTextCaret: VaporDirective<HTMLTextAreaElement> = (element) => {
  watchPostEffect(() => {
    const text = element.value;
    element.value = "";
    element.value = text;
  });
};
</script>

<template>
  <section class="profile" aria-label="Profile">
    <p v-if="user" v-mark="user.name">{{ user.name }}</p>
    <b v-if="typeof label === 'string'" v-mark="label">{{ label }}</b>
    <i v-if="nick" v-mark="nick">{{ nick }}</i>
    <s v-if="cleanup" v-mark="cleanup + track">{{ cleanup }}</s>
    <textarea
      v-model="note"
      v-text-caret
      v-mark="note"
      v-selectable="true"
      aria-label="Note"
    ></textarea>
    <button type="button" @click="user = user ? null : { name: 'Grace' }">Toggle</button>
    <button type="button" @click="label = 1">Count</button>
    <button type="button" @click="nick = undefined">Forget</button>
  </section>
</template>
