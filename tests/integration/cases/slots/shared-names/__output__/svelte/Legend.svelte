<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    items: string[];
    label: string;
    swatch?: Snippet<[{ item: string }]>;
    caption?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
  };

  let { items, label, swatch, caption, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul aria-label={label} class={className} {style} {...scopeAttributes(attributes)}>
  {#each items as item (item)}
    <li>
      <span>{@render swatch?.({ item })}</span> <span>{@render caption?.({ item })}</span>
    </li>
  {/each}
</ul>
