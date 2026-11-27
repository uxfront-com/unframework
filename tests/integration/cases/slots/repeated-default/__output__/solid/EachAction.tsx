import EachSlot from "./EachSlot";
import { type ComponentProps, type JSX, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface EachActionSlots {
  children?: JSX.Element;
}

export default function EachAction(
  props: { href?: string; items: string[] } & EachActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.DOMAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "items" | "children" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["href", "items", "children", "ref"]);

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
