import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface CalloutProps {
  heading: string;
  body: string;
}

export default component$<CalloutProps & { class?: ClassList; style?: CSSProperties }>(
  ({ heading, body, class: className, style, ...attributes }) => {
    return (
      <aside
        class={["callout", className]}
        aria-label={heading}
        style={{
          "--callout-accent": "#1f4d7a",
          borderLeft: "4px solid var(--callout-accent)",
          padding: "8px 12px",
          color: "#1a1a1a",
          ...style,
        }}
        {...scopeAttributes(attributes)}
      >
        <p style={{ margin: "0", fontWeight: "700" }}>{heading}</p>
        <p style={{ margin: "4px 0 0" }}>{body}</p>
      </aside>
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
