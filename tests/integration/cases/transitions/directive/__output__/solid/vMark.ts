import { queueHook } from "./_unframework/queueHook";
import { onCleanup } from "solid-js";

export function vMark(_getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    unmounted(el: HTMLElement) {
      document.dispatchEvent(new CustomEvent("mark-unmounted", { detail: el }));
    },
  };
  let target: HTMLElement | undefined;
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
  });
  return (element) => {
    target = element;
  };
}
