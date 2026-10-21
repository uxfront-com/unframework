import type { JSX } from "solid-js";

export interface CalloutProps {
  heading: string;
  body: string;
}

export default function Callout(
  props: CalloutProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <aside
      class={props.class ? `callout ${props.class}` : "callout"}
      aria-label={props.heading}
      style={{
        ...{
          "--callout-accent": "#1f4d7a",
          "border-left": "4px solid var(--callout-accent)",
          padding: "8px 12px",
          color: "#1a1a1a",
        },
        ...props.style,
      }}
      {...scopeAttributes(props)}
    >
      <p style={{ margin: "0", "font-weight": "700" }}>{props.heading}</p>
      <p style={{ margin: "4px 0 0" }}>{props.body}</p>
    </aside>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
