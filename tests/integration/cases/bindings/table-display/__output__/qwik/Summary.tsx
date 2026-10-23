import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export default component$<SummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, plan, seats, class: className, style, ...attributes }) => {
    return (
      <div
        class={["summary", className]}
        style={{ display: "table", borderSpacing: "8px 4px", ...style }}
        {...scopeAttributes(attributes)}
      >
        <div style={{ display: "table-caption", fontWeight: "700" }}>Account</div>
        <div style={{ display: "table-row" }}>
          <span style={{ display: "table-cell" }}>Name</span>
          <span style={{ display: "table-cell" }}>{name}</span>
        </div>
        <div style={{ display: "table-row" }}>
          <span style={{ display: "table-cell" }}>Plan</span>
          <span style={{ display: "table-cell" }}>
            {plan} for {seats} seats
          </span>
        </div>
        <p>
          Billed to <span style={{ display: "table-cell", padding: "0 4px" }}>{name}</span> monthly.
        </p>
      </div>
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
