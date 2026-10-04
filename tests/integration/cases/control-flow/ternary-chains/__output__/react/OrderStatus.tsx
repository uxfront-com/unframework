export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default function OrderStatus({ status, carrier, eta }: OrderStatusProps) {
  return (
    <p className="order-status">
      {status === "pending" ? (
        "Waiting for payment."
      ) : status === "shipped" ? (
        <>
          <strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.
        </>
      ) : status === "delivered" ? (
        <strong>Delivered</strong>
      ) : (
        <em>Cancelled</em>
      )}
    </p>
  );
}
