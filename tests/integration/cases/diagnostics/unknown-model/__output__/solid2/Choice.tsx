import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (value: string) => void;
}

export function Choice(
  props: ChoiceModels &
    Omit<ComponentProps<"button">, "picked" | "class" | "style" | "onClick"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const others = omit(props, "picked", "onPickedChange", "onClick");

  const [localPicked, setLocalPicked] = createState<string>("");
  const picked = () => (props.picked === undefined ? localPicked() : props.picked);

  function setPicked(next: string) {
    setLocalPicked(next);
    props.onPickedChange?.(next);
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        setPicked("yes");
        props.onClick?.(event);
      }}
      {...others}
    >
      Yes ({picked()})
    </button>
  );
}
