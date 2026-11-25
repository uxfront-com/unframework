import { createEffect, onCleanup } from "solid-js";

/**
 * The `ref` of a `<select>` whose options that hold `value`, or a value of it for an array, it
 * selects, and none where none holds it: as the value changes, and as options come and go.
 */
export function selectOptions(value: () => unknown): (select: HTMLSelectElement) => void {
  let bound: HTMLSelectElement | undefined;
  let observer: MutationObserver | undefined;
  const choose = (current: unknown) => {
    const select = bound;
    if (!select) return;
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  // Created here, as the `ref` is evaluated: Solid 2 creates no computation in a `ref` callback.
  createEffect(value, choose);
  onCleanup(() => observer?.disconnect());
  return (select) => {
    bound = select;
    observer = new MutationObserver(() => choose(value()));
    observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  };
}
