import type { ObjectDirective as ObjectDirective_1 } from "vue";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export const vSelectable: ObjectDirective_1<Field, boolean> = {
  mounted(el, { value }) {
    el.setAttribute("data-selectable", String(value));
    el.setAttribute(untrack, onMount);
    el.setAttribute(queueHook, ObjectDirective);
  },
};
