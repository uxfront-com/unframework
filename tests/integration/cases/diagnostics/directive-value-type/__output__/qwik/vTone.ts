export const vTone = {
  mounted(el: HTMLElement, tone: "info" | "warn") {
    el.setAttribute("data-tone", tone);
  },
};
