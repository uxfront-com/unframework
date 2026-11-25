// A directive whose element type is an alias its module declares (ADR-0099): a caller's output
// takes the type from the directive itself, never by the alias's name. Its hook reads constants
// named like the frameworks' imports and the queue helper its own module's output declares.
import { defineDirective } from "@uxfront/unframework";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export const vSelectable = defineDirective<boolean, Field>({
  mounted(el, value) {
    el.setAttribute("data-selectable", String(value));
    el.setAttribute(untrack, onMount);
    el.setAttribute(queueHook, ObjectDirective);
  },
});
