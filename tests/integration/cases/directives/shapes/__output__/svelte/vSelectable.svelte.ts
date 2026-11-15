import { untrack as untrack_1 } from "svelte";
import type { Attachment } from "svelte/attachments";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export function vSelectable(getValue: () => boolean): Attachment<Field> {
  const hooks = {
    mounted(el: Field, value: boolean) {
      el.setAttribute("data-selectable", String(value));
      el.setAttribute(untrack, onMount);
      el.setAttribute(queueHook, ObjectDirective);
    },
  };
  return (element) => {
    untrack_1(() => hooks.mounted(element, untrack_1(getValue)));
  };
}
