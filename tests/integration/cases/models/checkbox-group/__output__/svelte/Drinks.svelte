<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFieldsetAttributes } from "svelte/elements";

  type Props = Omit<HTMLFieldsetAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["fieldset"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let drinks = $state.raw<string[]>(["tea"]);
</script>

<fieldset class={className} {style} bind:this={ref} {...attributes}>
  <legend>Drinks</legend
  ><label><input type="checkbox" value="tea" bind:group={drinks} /> Tea</label
  ><label><input type="checkbox" value="coffee" bind:group={drinks} /> Coffee</label
  ><label><input type="checkbox" value="juice" bind:group={drinks} /> Juice</label
  ><output>Ordered: {drinks.join(", ") || "nothing"}</output
  ><button type="button" onclick={() => (drinks = ["juice"])}>Only juice</button>
</fieldset>
