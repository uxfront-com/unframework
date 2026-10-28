import type { JSX } from "solid-js";

export type StatusProps = Pick<SubscriptionLike, "closed"> & { label: string };

export default function Status(props: StatusProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.label}: {props.closed ? "closed" : "open"}
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
