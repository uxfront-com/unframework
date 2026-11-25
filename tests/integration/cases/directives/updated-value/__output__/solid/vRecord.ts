import { queueHook } from "./_unframework/queueHook";
import { createEffect, onMount, untrack } from "solid-js";

export function vRecord(getValue: () => number): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: number) {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-updates", "0");
    },
    updated(el: HTMLElement, value: number, oldValue: number) {
      el.setAttribute("data-value", String(value));
      el.setAttribute("data-old-value", String(oldValue));
      el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
    },
  };
  let target: HTMLElement | undefined;
  let current = untrack(getValue);
  onMount(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  createEffect(() => {
    const next = getValue();
    if (Object.is(next, current)) return;
    const previous = current;
    current = next;
    const element = target;
    if (element) queueHook(element, () => hooks.updated(element, next, previous), "updated");
  });
  return (element) => {
    target = element;
  };
}
