import { type JSX, Show, children } from "solid-js";

export interface ForwardedSlotSlots {
  children?: JSX.Element;
}

export default function ForwardedSlot(
  props: { depth: number } & ForwardedSlotSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const content = children(() => props.children);
  return (
    <div data-filled={content() ? "yes" : "no"} class={props.class} style={props.style}>
      <Show when={props.depth > 0}>
        <ForwardedSlot depth={props.depth - 1} children={content()} />
      </Show>
    </div>
  );
}
