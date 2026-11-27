import { type ComponentProps, type JSX, Show, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface LabelActionSlots {
  children?: JSX.Element;
}

export default function LabelAction(
  props: { href?: string; label: string } & LabelActionSlots &
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
      <Show when={props.label}>
        <span>{content() ?? props.label}</span>
      </Show>
    </Dynamic>
  );
}
