<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ListProps<T> {
    label: string;
    items: T[];
    selected?: T;
  }
</script>

<script lang="ts" generics="T">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "label" | "items" | "selected" | "children" | "class" | "style" | "ref"
  > &
    ListProps<T> & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["ul"] | null };

  let {
    label,
    items,
    selected,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul aria-label={label} class={className} {style} bind:this={ref} {...attributes}>
  {#each items as item, index (index)}
    <li aria-current={item === selected ? "true" : undefined}>{String(item)}</li>
  {/each}
</ul>
