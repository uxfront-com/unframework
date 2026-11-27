import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface FadeActionSlots {
  children?: JSX.Element;
}

export default function FadeAction(
  props: { href?: string; label: string } & FadeActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "label" | "children" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["href", "label", "children", "ref"]);

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
      <Transition name="fade">
        <span>{content() ?? props.label}</span>
      </Transition>
    </Dynamic>
  );
}
