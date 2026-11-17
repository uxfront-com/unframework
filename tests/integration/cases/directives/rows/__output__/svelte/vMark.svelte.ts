import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vMark(getValue: () => string): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `mark mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    updated(el: HTMLElement, value: string, oldValue: string) {
      const call = `mark updated ${value} ${oldValue}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = "mark unmounted";
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
  };
  return (element) => {
    let current = untrack(getValue);
    untrack(() => hooks.mounted(element, current));
    $effect(() => {
      const next = getValue();
      if (Object.is(next, current)) return;
      const previous = current;
      current = next;
      untrack(() => hooks.updated(element, next, previous));
    });
    return () => hooks.unmounted(element);
  };
}
