// Click outside (ADR-0099): the value is a function the directive calls when a click lands
// outside its element. The listener is the document's, added once the element is mounted and
// removed once it leaves; `updated` keeps the function the last render gave.
import { defineDirective } from "@uxfront/unframework";

interface Outside {
  callback: () => void;
  onClick: (event: MouseEvent) => void;
}

const outsides = new WeakMap<HTMLElement, Outside>();

export const vClickOutside = defineDirective<() => void>({
  mounted(el, callback) {
    const outside: Outside = {
      callback,
      onClick: (event) => {
        if (!el.contains(event.target as Node)) outside.callback();
      },
    };
    outsides.set(el, outside);
    document.addEventListener("click", outside.onClick);
  },
  updated(el, callback) {
    const outside = outsides.get(el);
    if (outside) outside.callback = callback;
  },
  unmounted(el) {
    const outside = outsides.get(el);
    if (outside) document.removeEventListener("click", outside.onClick);
    outsides.delete(el);
  },
});
