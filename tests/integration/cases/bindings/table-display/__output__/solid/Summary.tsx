import type { JSX } from "solid-js";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export default function Summary(
  props: SummaryProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `summary ${props.class}` : "summary"}
      style={{ ...{ display: "table", "border-spacing": "8px 4px" }, ...props.style }}
      {...scopeAttributes(props)}
    >
      <div style={{ display: "table-caption", "font-weight": "700" }}>Account</div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Name</span>
        <span style={{ display: "table-cell" }}>{props.name}</span>
      </div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Plan</span>
        <span style={{ display: "table-cell" }}>
          {props.plan} for {props.seats} seats
        </span>
      </div>
      <p>
        Billed to <span style={{ display: "table-cell", padding: "0 4px" }}>{props.name}</span>{" "}
        monthly.
      </p>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
