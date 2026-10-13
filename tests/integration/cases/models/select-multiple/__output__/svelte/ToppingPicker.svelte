<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let toppings = $state.raw<string[]>(["cheese"]);
</script>

<section aria-label="Pizza" class={className} {style}>
  <label>Toppings <select
    multiple
    bind:value={toppings}
  ><option value="cheese">Cheese</option><option value="olives">Olives</option><option
    value="basil"
  >Basil</option></select></label
  ><output>On top: {toppings.join(", ") || "nothing"}</output
  ><button type="button" onclick={() => (toppings = ["basil", "olives"])}>Green</button>
</section>
