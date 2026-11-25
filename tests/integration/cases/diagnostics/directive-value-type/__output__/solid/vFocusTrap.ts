import { queueHook } from "./_unframework/queueHook";
import { onMount, untrack } from "solid-js";

export function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, active: boolean) {
      if (active) el.focus();
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onMount(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  return (element) => {
    target = element;
  };
}
