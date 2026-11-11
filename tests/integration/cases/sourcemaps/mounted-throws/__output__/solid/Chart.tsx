import { type JSX, onMount } from "solid-js";

export default function Chart(props: { class?: string; style?: JSX.CSSProperties }) {
  onMount(() => {
    throw new Error("The chart could not start");
  });

  return (
    <p class={props.class} style={props.style} {...scopeAttributes(props)}>
      Chart
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
