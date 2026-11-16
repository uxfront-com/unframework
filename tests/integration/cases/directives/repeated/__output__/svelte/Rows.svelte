<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { row?: Snippet; class?: ClassValue; style?: string };

  let { row, class: className, style, ...attributes }: Props = $props();

  let items = $state.raw([1, 2]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["rows", className]} {style} {...scopeAttributes(attributes)}>
  <ul>
    {#each items as item (item)}
      <li>{@render row?.()}</li>
    {/each}
  </ul
  ><button type="button" onclick={() => (items = [...items, items.length + 1])}>Add row</button
  ><button type="button" onclick={() => (items = items.slice(0, -1))}>Remove row</button>
</div>
