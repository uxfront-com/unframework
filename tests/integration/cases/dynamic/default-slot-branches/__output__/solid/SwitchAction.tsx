import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface SwitchActionSlots {
  children?: JSX.Element;
}

export default function SwitchAction(
  props: { href?: string } & SwitchActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "children" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["href", "children", "ref"]);

  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      ref={(element: HTMLElementTagNameMap["a" | "button"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      <Show when={props.href} fallback={<i>{props.children}</i>}>
        <b>{props.children}</b>
      </Show>
    </Dynamic>
  );
}
