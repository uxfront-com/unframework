import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { children, omit } from "solid-js";

export interface IconActionSlots {
  children?: JSX.Element;
  icon?: JSX.Element;
}

export default function IconAction(
  props: { href?: string; label: string } & IconActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "label" | "children" | "icon" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "label", "children", "icon", "ref");

  const content = children(() => props.children);
  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      ref={(element: HTMLElementTagNameMap["a" | "button"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      {props.icon ?? <span>{content() ?? props.label}</span>}
    </Dynamic>
  );
}
