<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let toppings = $state.raw<string[]>(["cheese"]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Pizza" class={className} {style} {...scopeAttributes(attributes)}>
  <label>Toppings <select
    multiple
    bind:value={toppings}
  ><option value="cheese">Cheese</option><option value="olives">Olives</option><option
    value="basil"
  >Basil</option></select></label
  ><output>On top: {toppings.join(", ") || "nothing"}</output
  ><button type="button" onclick={() => (toppings = ["basil", "olives"])}>Green</button>
</section>
