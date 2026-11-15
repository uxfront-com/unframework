import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vRecord(getValue: () => number): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, value: number): void {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-updates", "0");
    },
    updated(el: HTMLElement, value: number, oldValue: number): void {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-old-value", String(oldValue));
      el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
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
  };
}
