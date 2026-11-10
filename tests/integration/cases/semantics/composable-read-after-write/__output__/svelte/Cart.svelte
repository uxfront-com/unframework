<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useCart } from "./useCart.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    ontotal?: (items: number) => void;
    oncleared?: (empty: boolean) => void;
    class?: ClassValue;
    style?: string;
  };

  let { ontotal, oncleared, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["cart", className]} aria-label="Cart" {style} {...scopeAttributes(attributes)}>
  <p role="status">Items: {cart.items}</p
  ><button type="button" onclick={addTwiceAndReport}>Add three</button
  ><button type="button" onclick={clearAndReport}>Clear</button>
</section>
