import type { JSX } from "solid-js";

function charge() {
  throw new Error("The card was declined");
}

export default function ChargeButton(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={charge}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Charge
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
