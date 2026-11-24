<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import Chip from "./Chip.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "label" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let compact = $state(true);

  const Component = $derived(compact ? Chip : Card);
</script>

<section aria-label="Tag" class={className} {style} bind:this={ref} {...attributes}>
  <Component {label}
  /><button
    type="button"
    onclick={() => (compact = !compact)}
  >{compact ? "Expand" : "Compact"}</button>
</section>
