import type { ComponentPropsWithRef } from "react";

export type ChargeButtonAttributes = Omit<ComponentPropsWithRef<"button">, "children">;

function charge() {
  throw new Error("The card was declined");
}

export default function ChargeButton({
  className,
  style,
  onClick,
  ...attributes
}: ChargeButtonAttributes) {
  return (
    <button
      type="button"
      onClick={(event) => {
        charge();
        onClick?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    >
      Charge
    </button>
  );
}
