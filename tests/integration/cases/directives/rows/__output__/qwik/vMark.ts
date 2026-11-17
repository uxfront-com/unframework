export const vMark = {
  mounted(el: HTMLElement, value: string) {
    const call = `mark mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el: HTMLElement, value: string, oldValue: string) {
    const call = `mark updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = "mark unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};
