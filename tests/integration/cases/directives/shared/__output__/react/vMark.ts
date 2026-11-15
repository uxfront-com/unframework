export const vMark = {
  mounted(el: HTMLElement, value: string): void {
    el.setAttribute("data-directive-mounted", value);
  },
};
