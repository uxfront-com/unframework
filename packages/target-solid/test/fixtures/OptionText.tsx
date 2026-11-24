import {
  type ComponentProps,
  type JSX,
  createEffect,
  createSignal,
  onCleanup,
  splitProps,
} from "solid-js";

export default function OptionText(
  props: { unit: string } & Omit<ComponentProps<"select">, "unit" | "style" | "onChange"> & {
      style?: JSX.CSSProperties;
      onChange?: Extract<ComponentProps<"select">["onChange"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["unit", "onChange"]);

  const [amount, setAmount] = createSignal("2 kg");

  return (
    <select
      aria-label="Amount"
      onChange={(event) => {
        setAmount(event.currentTarget.value);
        props.onChange?.(event);
      }}
      ref={(select) => selectOptions(select, amount)}
      {...others}
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
    for (const option of select.options) {
      option.selected = current.includes(option.value);
    }
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
