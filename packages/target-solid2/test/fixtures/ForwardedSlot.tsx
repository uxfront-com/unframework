import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, children, omit } from "solid-js";

export interface ForwardedSlotSlots {
  children?: JSX.Element;
}

export default function ForwardedSlot(
  props: { depth: number } & ForwardedSlotSlots &
    Omit<ComponentProps<"div">, "depth" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "depth", "children");

  const content = children(() => props.children);
  return (
    <div data-filled={content() ? "yes" : "no"} {...others}>
      <Show when={props.depth > 0}>
        <ForwardedSlot depth={props.depth - 1} children={content()} />
      </Show>
    </div>
  );
}
