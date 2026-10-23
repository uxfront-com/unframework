<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import SearchField from "./SearchField.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let search: { focus(): void } | null = null;

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<header class={["header", className]} {style} {...scopeAttributes(attributes)}>
  <SearchField bind:this={search} label="Find"
  /><button type="button" onclick={() => search?.focus()}>Search</button>
</header>
