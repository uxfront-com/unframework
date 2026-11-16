export const vMark = {
  unmounted(el: HTMLElement) {
    document.dispatchEvent(new CustomEvent("mark-unmounted", { detail: el }));
  },
};
