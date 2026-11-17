export const vTrace = {
  mounted(el: HTMLElement, value: string) {
    const call = `trace mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el: HTMLElement, value: string, oldValue: string) {
    const call = `trace updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = "trace unmounted";
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};
