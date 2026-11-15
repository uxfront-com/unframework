<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    items: string[];
    item?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
  };

  let { items, item: itemSnippet, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ol class={className} {style} {...scopeAttributes(attributes)}>
  {#each items as item (item)}
    <li>{@render itemSnippet?.({ item })}</li>
  {/each}
</ol>
