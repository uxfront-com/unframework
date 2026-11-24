import { queueHook } from "./_unframework/queueHook";
import { createEffect, onCleanup, onSettled, untrack } from "solid-js";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

export function vClickOutside(getValue: () => () => void): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, callback: () => void) {
      const outside: Outside = {
        callback,
        onClick: (event) => {
          if (!el.contains(event.target as Node)) outside.callback();
        },
      };
      outsides.set(el, outside);
      document.addEventListener("click", outside.onClick);
    },
    updated(el: HTMLElement, callback: () => void) {
      const outside = outsides.get(el);
      if (outside) outside.callback = callback;
    },
    unmounted(el: HTMLElement) {
      const outside = outsides.get(el);
      if (outside) document.removeEventListener("click", outside.onClick);
      outsides.delete(el);
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
    current = next;
    const element = target;
    if (element) queueHook(element, () => hooks.updated(element, next), "updated");
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
  });
  return (element) => {
    target = element;
  };
}
