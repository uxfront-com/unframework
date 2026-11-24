import { queueHook } from "./_unframework/queueHook";
import { onSettled, untrack } from "solid-js";

export function vMark(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      el.setAttribute("data-directive-mounted", value);
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onSettled(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  return (element) => {
    target = element;
  };
}
