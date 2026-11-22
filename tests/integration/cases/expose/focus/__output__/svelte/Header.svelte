<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import SearchField from "./SearchField.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["header"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["header"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let search: { focus(): void } | null = null;
</script>

<header class={["header", className]} {style} bind:this={ref} {...attributes}>
  <SearchField bind:this={search} label="Find"
  /><button type="button" onclick={() => search?.focus()}>Search</button>
</header>
