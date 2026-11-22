import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (value: string) => void;
}

export function Choice(
  props: ChoiceModels &
    Omit<ComponentProps<"button">, "picked" | "style" | "onClick"> & {
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["picked", "onPickedChange", "onClick"]);

  const [localPicked, setLocalPicked] = createSignal<string>("");
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
