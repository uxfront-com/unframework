import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vNote(getValue: () => string): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
  };
  return (element) => {
    untrack(() => hooks.mounted(element, untrack(getValue)));
    return () => hooks.unmounted(element);
  };
}
