import { type JSX, Match, Switch } from "solid-js";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default function OrderStatus(
  props: OrderStatusProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={props.class ? `order-status ${props.class}` : "order-status"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Switch fallback={<em>Cancelled</em>}>
        <Match when={props.status === "pending"}>Waiting for payment.</Match>
        <Match when={props.status === "shipped"}>
          <strong>Shipped</strong> with {props.carrier ?? "our courier"}, arriving{" "}
          {props.eta ?? "soon"}.
        </Match>
        <Match when={props.status === "delivered"}>
          <strong>Delivered</strong>
        </Match>
      </Switch>
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
