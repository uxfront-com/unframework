<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PickerProps<T> {
    items: T[];
  }
</script>

<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = PickerProps<T> & {
    item?: Snippet<[{ item: T }]>;
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

<ul class={className} {style} {...scopeAttributes(attributes)}>
  {#each items as item, index (index)}
    <li>{@render itemSnippet?.({ item })}</li>
  {/each}
</ul>
