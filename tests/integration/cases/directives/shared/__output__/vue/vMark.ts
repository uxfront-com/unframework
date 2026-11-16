import type { ObjectDirective } from "vue";

export const vMark: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    el.setAttribute("data-directive-mounted", value);
  },
};
