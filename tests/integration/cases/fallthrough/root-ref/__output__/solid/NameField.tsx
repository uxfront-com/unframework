import {
  type ComponentProps,
  type JSX,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

export default function NameField(
  props: { label: string } & Omit<ComponentProps<"input">, "label" | "style" | "onFocus"> & {
      style?: JSX.CSSProperties;
      onFocus?: Extract<ComponentProps<"input">["onFocus"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["label", "onFocus"]);

  let input: HTMLInputElement | null = null;
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(input !== null);
  });

  function fill() {
    if (input && !input.value && mounted()) input.value = "Ada";
  }

  return (
    <input
      ref={(element) => {
        input = element;
        onCleanup(() => {
          input = null;
        });
      }}
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
