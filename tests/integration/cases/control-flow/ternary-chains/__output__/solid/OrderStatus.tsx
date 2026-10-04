import { Match, Switch } from "solid-js";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default function OrderStatus(props: OrderStatusProps) {
  return (
    <p class="order-status">
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
