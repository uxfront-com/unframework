<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface OrderSummaryProps {
    customer: string;
    orderNumber: number;
    unitPrice: number;
    quantity: number;
    discount: number;
    coupon?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    | "customer"
    | "orderNumber"
    | "unitPrice"
    | "quantity"
    | "discount"
    | "coupon"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    OrderSummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    customer,
    orderNumber,
    unitPrice,
    quantity,
    discount,
    coupon,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["order-summary", className]}
  aria-label="Order summary"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>Order {String(orderNumber).padStart(6, "0")}</h2
  ><p>Customer: {customer.trim().toUpperCase()}</p
  ><p>{`${quantity} item${quantity === 1 ? "" : "s"} at ${unitPrice.toFixed(2)} each`}</p
  ><p>Subtotal: {(unitPrice * quantity).toFixed(2)}</p
  ><p>Discount: {Math.min(Math.max(discount, 0), 50)}%</p
  ><p>Total: {(unitPrice * quantity * (1 - Math.min(Math.max(discount, 0), 50) / 100)).toFixed(2)}</p
  ><p>{quantity > 10 ? "Bulk order" : "Standard order"}, {coupon ? "coupon applied" : "no coupon"}</p
  ><p>Points earned: {Math.round(unitPrice * quantity) % 100}</p>
</section>
