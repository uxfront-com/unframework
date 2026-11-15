export const vTrace = {
  mounted(el: HTMLElement, value: string) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  updated(el: HTMLElement, value: string, oldValue: string) {
    const call = `updated ${value} ${oldValue}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    document.dispatchEvent(
      new CustomEvent("directive-trace", { detail: { call: "unmounted", el } }),
    );
  },
};
