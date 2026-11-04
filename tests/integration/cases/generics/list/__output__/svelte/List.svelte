<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ListProps<T> {
    label: string;
    items: T[];
    selected?: T;
  }
</script>

<script lang="ts" generics="T">
  import type { ClassValue } from "svelte/elements";

  type Props = ListProps<T> & { class?: ClassValue; style?: string };

  let { label, items, selected, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul aria-label={label} class={className} {style} {...scopeAttributes(attributes)}>
  {#each items as item, index (index)}
    <li aria-current={item === selected ? "true" : undefined}>{String(item)}</li>
  {/each}
</ul>
