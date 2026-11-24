import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export default component$<
  SummaryProps &
    Omit<PropsOf<"div">, "name" | "plan" | "seats" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, plan, seats, class: className, style, ...attributes }) => {
  return (
    <div
      class={["summary", className]}
      style={{ display: "table", borderSpacing: "8px 4px", ...style }}
      {...attributes}
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
});
