import { queueHook } from "./_unframework/queueHook";
import { createEffect, onCleanup, onSettled, untrack } from "solid-js";

export function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `trace mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    updated(el: HTMLElement, value: string, oldValue: string) {
      const call = `trace updated ${value} ${oldValue}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = "trace unmounted";
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
  };
  let target: HTMLElement | undefined;
  let current = untrack(getValue);
  onSettled(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  createEffect(getValue, (next) => {
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
