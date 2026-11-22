<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Level from "./Level.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "children" | "class" | "style" | "ref" | "title"
  > & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["section"] | null };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Level title="Book" class={className} {style} bind:ref {...attributes}>
  <Level title="Part"><Level title="Chapter" /></Level><Level title="Appendix" />
</Level>
