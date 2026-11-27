import OnceSlot from "./OnceSlot";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { children, omit } from "solid-js";

export interface OnceActionSlots {
  children?: JSX.Element;
}

export default function OnceAction(
  props: { href?: string; label: string } & OnceActionSlots &
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
      <OnceSlot
        label={props.label}
        text={(shown) => <span class="once-fill">{content() ?? shown.label}</span>}
      />
    </Dynamic>
  );
}
