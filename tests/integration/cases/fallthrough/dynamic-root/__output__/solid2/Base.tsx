import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface BaseEvents {
  onPress?: () => void;
}

export default function Base(
  props: { href?: string; disabled?: boolean; text: string } & BaseEvents &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "disabled" | "text" | "onPress" | "class" | "style" | "onClick"
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
  const others = omit(
    props,
    "href",
    "disabled",
    "text",
    "onPress",
    "ref",
    "class",
    "style",
    "onClick",
  );

  function press(event: MouseEvent) {
    event.preventDefault();
    props.onPress?.();
  }

  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      disabled={(props.href ? "a" : "button") === "button" ? props.disabled : undefined}
      class={props.class ? `base ${props.class}` : "base"}
      style={{ ...{ padding: "4px 8px" }, ...props.style }}
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
