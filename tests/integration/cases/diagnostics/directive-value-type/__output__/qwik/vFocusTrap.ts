export const vFocusTrap = {
  mounted(el: HTMLElement, active: boolean) {
    if (active) el.focus();
  },
};
