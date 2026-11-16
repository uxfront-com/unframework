import type { ObjectDirective } from "vue";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

export const vClickOutside: ObjectDirective<HTMLElement, () => void> = {
  mounted(el, { value: callback }) {
    const outside: Outside = {
      callback,
      onClick: (event) => {
        if (!el.contains(event.target as Node)) outside.callback();
      },
    };
    outsides.set(el, outside);
    document.addEventListener("click", outside.onClick);
  },
  updated(el, { value: callback, oldValue }) {
    if (Object.is(callback, oldValue)) return;
    const outside = outsides.get(el);
    if (outside) outside.callback = callback;
  },
  unmounted(el) {
    const outside = outsides.get(el);
    if (outside) document.removeEventListener("click", outside.onClick);
    outsides.delete(el);
  },
};
