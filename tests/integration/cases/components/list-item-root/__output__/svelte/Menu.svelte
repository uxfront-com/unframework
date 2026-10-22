<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Item from "./Item.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { entries: string[]; class?: ClassValue; style?: string };

  let { entries, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul aria-label="Menu" class={className} {style} {...scopeAttributes(attributes)}>
  {#each entries as entry (entry)}
    <Item label={entry} />
  {/each}
</ul>
