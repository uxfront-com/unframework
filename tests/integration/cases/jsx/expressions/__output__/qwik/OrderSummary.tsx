import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

export default component$<OrderSummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({
    customer,
    orderNumber,
    unitPrice,
    quantity,
    discount,
    coupon,
    class: className,
    style,
    ...attributes
  }) => {
    return (
      <section
        class={["order-summary", className]}
        aria-label="Order summary"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>Order {String(orderNumber).padStart(6, "0")}</h2>
        <p>Customer: {customer.trim().toUpperCase()}</p>
        <p>{`${quantity} item${quantity === 1 ? "" : "s"} at ${unitPrice.toFixed(2)} each`}</p>
        <p>Subtotal: {(unitPrice * quantity).toFixed(2)}</p>
        <p>Discount: {Math.min(Math.max(discount, 0), 50)}%</p>
        <p>
          Total:{" "}
          {(unitPrice * quantity * (1 - Math.min(Math.max(discount, 0), 50) / 100)).toFixed(2)}
        </p>
        <p>
          {quantity > 10 ? "Bulk order" : "Standard order"},{" "}
          {coupon ? "coupon applied" : "no coupon"}
        </p>
        <p>Points earned: {Math.round(unitPrice * quantity) % 100}</p>
      </section>
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
