import { Transition } from "./_unframework/Transition";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { children, omit } from "solid-js";

export interface FadeActionSlots {
  children?: JSX.Element;
}

export default function FadeAction(
  props: { href?: string; label: string } & FadeActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "label" | "children" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "label", "children", "ref");

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
