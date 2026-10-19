import { type JSX, createEffect, createSignal } from "solid-js";

export default function OptionText(
  props: { unit: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [amount, setAmount] = createSignal("2 kg");

  return (
    <select
      aria-label="Amount"
      onChange={(event) => setAmount(event.currentTarget.value)}
      ref={(select) =>
        createEffect(() => {
          if (select.value !== String(amount())) select.selectedIndex = -1;
        })
      }
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
