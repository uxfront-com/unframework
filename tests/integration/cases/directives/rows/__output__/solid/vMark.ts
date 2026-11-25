import { queueHook } from "./_unframework/queueHook";
import { createEffect, onCleanup, onMount, untrack } from "solid-js";

export function vMark(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `mark mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    updated(el: HTMLElement, value: string, oldValue: string) {
      const call = `mark updated ${value} ${oldValue}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = "mark unmounted";
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
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
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
  });
  return (element) => {
    target = element;
  };
}
