import type { ObjectDirective } from "vue";

export const vRecord: ObjectDirective<HTMLElement, number> = {
  mounted(el, { value }) {
    el.setAttribute("data-value", String(value));
    el.setAttribute("data-updates", "0");
  },
  updated(el, { value, oldValue }) {
    if (Object.is(value, oldValue)) return;
    el.setAttribute("data-value", String(value));
    el.setAttribute("data-old-value", String(oldValue));
    el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
  },
};
