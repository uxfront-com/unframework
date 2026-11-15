type Field = HTMLInputElement | HTMLTextAreaElement;

export const vSelectable = {
  mounted(el: Field, value: boolean) {
    el.setAttribute("data-selectable", String(value));
  },
};
