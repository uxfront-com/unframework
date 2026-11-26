import { queueHook } from "./_unframework/queueHook";
import { onSettled, untrack } from "solid-js";

export function vTone(getValue: () => "info" | "warn"): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, tone: "info" | "warn") {
      el.setAttribute("data-tone", tone);
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
