import type { ObjectDirective } from "vue";

type Field = HTMLInputElement | HTMLTextAreaElement;

export const vSelectable: ObjectDirective<Field, boolean> = {
  mounted(el, { value }) {
    el.setAttribute("data-selectable", String(value));
  },
};
