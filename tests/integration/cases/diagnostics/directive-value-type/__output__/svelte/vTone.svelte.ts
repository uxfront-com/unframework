import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vTone(getValue: () => "info" | "warn"): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, tone: "info" | "warn") {
      el.setAttribute("data-tone", tone);
    },
  };
  return (element) => {
    untrack(() => hooks.mounted(element, untrack(getValue)));
  };
}
