import { type JSX, createEffect, createSignal, onCleanup } from "solid-js";

export default function UnmatchedSelect(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal("xl");

  return (
    <form class={props.class} style={props.style}>
      <select
        aria-label="Size"
        onChange={(event) => setSize(event.currentTarget.value)}
        ref={(select) => selectOptions(select, size)}
      >
        <option value="s" selected={size() === "s"}>
          S
        </option>
        <option value="m" selected={size() === "m"}>
          M
        </option>
      </select>
      <button type="button" onClick={() => setSize("m")}>
        M
      </button>
      <button type="button" onClick={() => setSize("xs")}>
        XS
      </button>
    </form>
  );
}

/**
 * Selects a `<select>`'s options that hold `value`, or a value of it for an array, and none
 * where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(select: HTMLSelectElement, value: () => unknown): void {
  const choose = () => {
    const current = value();
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
