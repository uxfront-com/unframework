import type { ObjectDirective } from "vue";

export const vFocusTrap: ObjectDirective<HTMLElement, boolean> = {
  mounted(el, { value: active }) {
    if (active) el.focus();
  },
};
