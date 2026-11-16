export const vRecord = {
  mounted(el: HTMLElement, value: number) {
    el.setAttribute("data-value", String(value));
    el.setAttribute("data-updates", "0");
  },
  updated(el: HTMLElement, value: number, oldValue: number) {
    el.setAttribute("data-value", String(value));
    el.setAttribute("data-old-value", String(oldValue));
    el.setAttribute("data-updates", String(Number(el.getAttribute("data-updates")) + 1));
  },
};
