import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vMark(getValue: () => string): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      el.setAttribute("data-directive-mounted", value);
    },
  };
  return (element) => {
    untrack(() => hooks.mounted(element, untrack(getValue)));
  };
}
