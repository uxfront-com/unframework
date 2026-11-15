type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export const vSelectable = {
  mounted(el: Field, value: boolean) {
    el.setAttribute("data-selectable", String(value));
    el.setAttribute(untrack, onMount);
    el.setAttribute(queueHook, ObjectDirective);
  },
};
