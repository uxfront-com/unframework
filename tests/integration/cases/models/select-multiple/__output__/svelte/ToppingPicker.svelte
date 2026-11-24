<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let toppings = $state.raw<string[]>(["cheese"]);
</script>

<section aria-label="Pizza" class={className} {style} bind:this={ref} {...attributes}>
  <label>Toppings <select
    multiple
    bind:value={toppings}
  ><option value="cheese">Cheese</option><option value="olives">Olives</option><option
    value="basil"
  >Basil</option></select></label
  ><output>On top: {toppings.join(", ") || "nothing"}</output
  ><button type="button" onclick={() => (toppings = ["basil", "olives"])}>Green</button>
</section>
