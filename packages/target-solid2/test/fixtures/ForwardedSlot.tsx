import { type JSX, Show, children } from "solid-js";

export interface ForwardedSlotSlots {
  children?: JSX.Element;
}

export default function ForwardedSlot(
  props: { depth: number } & ForwardedSlotSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const content = children(() => props.children);
  return (
    <div
      data-filled={content() ? "yes" : "no"}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={props.depth > 0}>
        <ForwardedSlot depth={props.depth - 1} children={content()} />
      </Show>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
