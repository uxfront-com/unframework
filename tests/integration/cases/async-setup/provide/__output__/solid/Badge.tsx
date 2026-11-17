import { type JSX, createContext, useContext } from "solid-js";

export const ToneKey = createContext<string>();

export default function Badge(props: { class?: string; style?: JSX.CSSProperties }) {
  const tone = useContext(ToneKey) ?? "plain";

  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Tone: {tone}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
