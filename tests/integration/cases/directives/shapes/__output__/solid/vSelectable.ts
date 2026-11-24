import { queueHook as queueHook_1 } from "./_unframework/queueHook";
import { onMount as onMount_1, untrack as untrack_1 } from "solid-js";

type Field = HTMLInputElement | HTMLTextAreaElement;

const untrack = "data-untrack";
const onMount = "mounted";
const queueHook = "data-queue";
const ObjectDirective = "queued";

export function vSelectable(getValue: () => boolean): (element: Field) => void {
  const hooks = {
    mounted(el: Field, value: boolean) {
      el.setAttribute("data-selectable", String(value));
      el.setAttribute(untrack, onMount);
      el.setAttribute(queueHook, ObjectDirective);
    },
  };
  let target: Field | undefined;
  const current = untrack_1(getValue);
  onMount_1(() => {
    const element = target;
    if (element) queueHook_1(element, () => hooks.mounted(element, current), "mounted");
  });
  return (element) => {
    target = element;
  };
}
