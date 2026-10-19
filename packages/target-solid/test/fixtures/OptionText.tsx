import { type JSX, createEffect, createSignal, onCleanup } from "solid-js";

export default function OptionText(
  props: { unit: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [amount, setAmount] = createSignal("2 kg");

  return (
    <select
      aria-label="Amount"
      onChange={(event) => setAmount(event.currentTarget.value)}
      ref={(select) => selectOptions(select, amount)}
      class={props.class}
      style={props.style}
    >
      <option
        selected={
          amount() ===
          String("  1 " + props.unit)
            .replace(/[\t\n\f\r ]+/g, " ")
            .replace(/^ | $/g, "")
        }
      >
        {"  1 "}
        {props.unit}
      </option>
      <option
        selected={
          amount() ===
          String("  2 " + props.unit + " ")
            .replace(/[\t\n\f\r ]+/g, " ")
            .replace(/^ | $/g, "")
        }
      >
        {"  2 "}
        {props.unit}{" "}
      </option>
    </select>
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
