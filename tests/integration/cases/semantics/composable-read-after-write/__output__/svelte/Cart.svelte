<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useCart } from "./useCart.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "ontotal" | "oncleared" | "children" | "class" | "style" | "ref"
  > & {
    ontotal?: (items: number) => void;
    oncleared?: (empty: boolean) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    ontotal,
    oncleared,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const cart = useCart();

  function addTwiceAndReport() {
    cart.add(1);
    cart.add(2);
    ontotal?.(cart.items);
  }

  function clearAndReport() {
    cart.clear();
    oncleared?.(cart.empty);
  }
</script>

<section class={["cart", className]} aria-label="Cart" {style} bind:this={ref} {...attributes}>
  <p role="status">Items: {cart.items}</p
  ><button type="button" onclick={addTwiceAndReport}>Add three</button
  ><button type="button" onclick={clearAndReport}>Clear</button>
</section>
