import type { ObjectDirective } from "vue";

export const vTone: ObjectDirective<HTMLElement, "info" | "warn"> = {
  mounted(el, { value: tone }) {
    el.setAttribute("data-tone", tone);
  },
};
