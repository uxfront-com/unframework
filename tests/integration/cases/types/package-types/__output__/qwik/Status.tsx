import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export type StatusProps = Pick<SubscriptionLike, "closed"> & { label: string };

export default component$<StatusProps & { class?: ClassList; style?: CSSProperties }>(
  ({ closed, label, class: className, style, ...attributes }) => {
    return (
      <p {...scopeAttributes(attributes)} class={className} style={style}>
        {label}: {closed ? "closed" : "open"}
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
