import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onSettled } from "solid-js";

export default function NameField(
  props: { label: string } & Omit<
    ComponentProps<"input">,
    "label" | "class" | "style" | "onFocus"
  > & {
      class?: string;
      style?: JSX.CSSProperties;
      onFocus?: Extract<ComponentProps<"input">["onFocus"], (event: never) => void>;
    },
) {
  const others = omit(props, "label", "onFocus");

  let input: HTMLInputElement | null = null;
  const [mounted, setMounted] = createState(false);

  onSettled(() => {
    setMounted(input !== null);
  });

  function fill() {
    if (input && !input.value && mounted()) input.value = "Ada";
  }

  return (
    <input
      ref={clearedRef(
        (element) => {
          input = element;
        },
        () => {
          input = null;
        },
      )}
      name="name"
      aria-label={props.label}
      onFocus={(event) => {
        fill();
        props.onFocus?.(event);
      }}
      {...others}
    />
  );
}
