<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let drinks = $state.raw<string[]>(["tea"]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<fieldset class={className} {style} {...scopeAttributes(attributes)}>
  <legend>Drinks</legend
  ><label><input type="checkbox" value="tea" bind:group={drinks} /> Tea</label
  ><label><input type="checkbox" value="coffee" bind:group={drinks} /> Coffee</label
  ><label><input type="checkbox" value="juice" bind:group={drinks} /> Juice</label
  ><output>Ordered: {drinks.join(", ") || "nothing"}</output
  ><button type="button" onclick={() => (drinks = ["juice"])}>Only juice</button>
</fieldset>
