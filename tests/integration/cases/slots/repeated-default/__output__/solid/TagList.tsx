import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, children, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface TagListSlots {
  children?: JSX.Element;
}

export default function TagList(
  props: { ordered: boolean; label: string; items: string[] } & TagListSlots &
    Omit<
      Omit<
        ComponentProps<"ol"> & ComponentProps<"ul">,
        keyof JSX.DOMAttributes<HTMLElementTagNameMap["ol" | "ul"]>
      > &
        JSX.DOMAttributes<HTMLElementTagNameMap["ol" | "ul"]>,
      "ordered" | "label" | "items" | "children" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["ordered", "label", "items", "children", "ref", "class"]);

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
