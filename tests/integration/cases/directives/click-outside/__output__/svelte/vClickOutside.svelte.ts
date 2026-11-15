import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

export function vClickOutside(getValue: () => () => void): Attachment<HTMLElement> {
  const hooks = {
    mounted(el: HTMLElement, callback: () => void): void {
      const outside: Outside = {
        callback,
        onClick: (event) => {
          if (!el.contains(event.target as Node)) outside.callback();
        },
      };
      outsides.set(el, outside);
      document.addEventListener("click", outside.onClick);
    },
    updated(el: HTMLElement, callback: () => void): void {
      const outside = outsides.get(el);
      if (outside) outside.callback = callback;
    },
    unmounted(el: HTMLElement): void {
      const outside = outsides.get(el);
      if (outside) document.removeEventListener("click", outside.onClick);
      outsides.delete(el);
    },
  };
  return (element) => {
    let current = untrack(getValue);
    untrack(() => hooks.mounted(element, current));
    $effect(() => {
      const next = getValue();
      if (Object.is(next, current)) return;
      current = next;
      untrack(() => hooks.updated(element, next));
    });
    return () => hooks.unmounted(element);
  };
}
