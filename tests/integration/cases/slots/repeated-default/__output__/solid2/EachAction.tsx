import EachSlot from "./EachSlot";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { children, omit } from "solid-js";

export interface EachActionSlots {
  children?: JSX.Element;
}

export default function EachAction(
  props: { href?: string; items: string[] } & EachActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "items" | "children" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "items", "children", "ref");

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
      <EachSlot
        items={props.items}
        row={({ item }) => <span class="each-fill">{content() ?? item}</span>}
      />
    </Dynamic>
  );
}
