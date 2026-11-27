import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { children, omit } from "solid-js";

export interface TagListSlots {
  children?: JSX.Element;
}

export default function TagList(
  props: { ordered: boolean; label: string; items: string[] } & TagListSlots &
    Omit<
      Omit<
        ComponentProps<"ol"> & ComponentProps<"ul">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["ol" | "ul"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["ol" | "ul"]>,
      "ordered" | "label" | "items" | "children" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "ordered", "label", "items", "children", "ref", "class");

  return (
    <Dynamic
      component={props.ordered ? "ol" : "ul"}
      class={props.class ? `tag-list ${props.class}` : "tag-list"}
      aria-label={props.label}
      ref={(element: HTMLElementTagNameMap["ol" | "ul"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => {
          const content = children(() => props.children);
          return <li>{content() ?? item.value}</li>;
        }}
      </KeyedFor>
    </Dynamic>
  );
}
