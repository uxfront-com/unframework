<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge from "./Badge.svelte";
  import Panel from "./Panel.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["main"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["main"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<main class={className} {style} bind:this={ref} {...attributes}>
  <Panel id="ada">
    <Badge />
  </Panel>
</main>
