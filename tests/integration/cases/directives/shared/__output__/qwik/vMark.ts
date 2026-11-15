export const vMark = {
  mounted(el: HTMLElement, value: string) {
    el.setAttribute("data-directive-mounted", value);
  },
};
