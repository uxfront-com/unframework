import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

type Field = HTMLInputElement | HTMLTextAreaElement;

export function vSelectable(getValue: () => boolean): Attachment<Field> {
  const hooks = {
    mounted(el: Field, value: boolean) {
      el.setAttribute("data-selectable", String(value));
    },
  };
  return (element) => {
    untrack(() => hooks.mounted(element, untrack(getValue)));
  };
}
