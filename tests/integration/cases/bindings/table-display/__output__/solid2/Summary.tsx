import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export default function Summary(
  props: SummaryProps &
    Omit<ComponentProps<"div">, "name" | "plan" | "seats" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "plan", "seats", "class", "style");

  return (
    <div
      class={props.class ? `summary ${props.class}` : "summary"}
      style={{ ...{ display: "table", "border-spacing": "8px 4px" }, ...props.style }}
      {...others}
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
