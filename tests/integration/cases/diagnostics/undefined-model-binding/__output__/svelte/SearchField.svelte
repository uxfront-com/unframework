<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "query" | "children" | "class" | "style" | "ref"> & {
    query?: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["input"] | null;
  };

  let {
    query = $bindable(),
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<input
  type="search"
  aria-label="Search"
  bind:value={query}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
/>
