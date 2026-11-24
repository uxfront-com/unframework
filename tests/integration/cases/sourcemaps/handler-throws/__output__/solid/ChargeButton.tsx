import { type ComponentProps, type JSX, splitProps } from "solid-js";

function charge() {
  throw new Error("The card was declined");
}

export default function ChargeButton(
  props: Omit<ComponentProps<"button">, "style" | "onClick"> & {
    style?: JSX.CSSProperties;
    onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
  },
) {
  const [, others] = splitProps(props, ["onClick"]);

  return (
    <button
      type="button"
      onClick={(event) => {
        charge();
        props.onClick?.(event);
      }}
      {...others}
    >
      Charge
    </button>
  );
}
