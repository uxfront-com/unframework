import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

function charge() {
  throw new Error("The card was declined");
}

export default function ChargeButton(
  props: Omit<ComponentProps<"button">, "class" | "style" | "onClick"> & {
    class?: string;
    style?: JSX.CSSProperties;
    onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
  },
) {
  const others = omit(props, "onClick");

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
