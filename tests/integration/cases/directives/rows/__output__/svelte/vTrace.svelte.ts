import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vTrace(getValue: () => string): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `trace mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    updated(el: HTMLElement, value: string, oldValue: string) {
      const call = `trace updated ${value} ${oldValue}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = "trace unmounted";
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
