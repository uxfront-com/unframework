import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

export function vFocusTrap(getValue: () => boolean): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, active: boolean) {
      if (active) el.focus();
    },
  };
  return (element) => {
    untrack(() => hooks.mounted(element, untrack(getValue)));
  };
}
