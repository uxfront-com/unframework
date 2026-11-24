import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

function press(event: MouseEvent) {
  event.preventDefault();
}

export default function Base(
  props: { href?: string; disabled?: boolean; text: string } & Omit<
    Omit<
      ComponentProps<"a"> & ComponentProps<"button">,
      keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
    > &
      JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
    "href" | "disabled" | "text" | "class" | "style" | "onClick"
  > & {
      class?: string;
      style?: JSX.CSSProperties;
      onClick?: Extract<
        (Omit<
          ComponentProps<"a"> & ComponentProps<"button">,
          keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
        > &
          JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>)["onClick"],
        (event: never) => void
      >;
    },
) {
  const others = omit(props, "href", "disabled", "text", "ref", "class", "onClick");

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
