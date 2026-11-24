import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

function press(event: MouseEvent) {
  event.preventDefault();
}

export default function Base(
  props: { href?: string; disabled?: boolean; text: string } & Omit<
    Omit<
      ComponentProps<"a"> & ComponentProps<"button">,
      keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
    > &
      JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>,
    "href" | "disabled" | "text" | "style" | "onClick"
  > & {
      style?: JSX.CSSProperties;
      onClick?: Extract<
        (Omit<
          ComponentProps<"a"> & ComponentProps<"button">,
          keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
        > &
          JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>)["onClick"],
        (event: never) => void
      >;
    },
) {
  const [, others] = splitProps(props, ["href", "disabled", "text", "ref", "class", "onClick"]);

  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      disabled={(props.href ? "a" : "button") === "button" ? props.disabled : undefined}
      class={props.class ? `base ${props.class}` : "base"}
      title="Base"
      onClick={
        ((event) => {
          press(event);
          props.onClick?.(event);
        }) satisfies typeof props.onClick
      }
      ref={(element: HTMLElementTagNameMap["a" | "button"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      {props.text}
    </Dynamic>
  );
}
