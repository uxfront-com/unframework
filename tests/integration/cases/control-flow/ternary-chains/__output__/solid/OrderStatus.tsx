import { type ComponentProps, type JSX, Match, Switch, splitProps } from "solid-js";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default function OrderStatus(
  props: OrderStatusProps &
    Omit<ComponentProps<"p">, "status" | "carrier" | "eta" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["status", "carrier", "eta", "class"]);

  return (
    <p class={props.class ? `order-status ${props.class}` : "order-status"} {...others}>
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
