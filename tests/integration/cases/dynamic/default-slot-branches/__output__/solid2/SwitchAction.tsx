import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface SwitchActionSlots {
  children?: JSX.Element;
}

export default function SwitchAction(
  props: { href?: string } & SwitchActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "children" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "children", "ref");

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
