import { type ComponentProps, type JSX, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface IconActionSlots {
  children?: JSX.Element;
  icon?: JSX.Element;
}

export default function IconAction(
  props: { href?: string; label: string } & IconActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "label" | "children" | "icon" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["href", "label", "children", "icon", "ref"]);

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
