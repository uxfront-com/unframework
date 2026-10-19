<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import Card from "./Card.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    wide: boolean;
    title?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { label, wide, title, class: className, style }: Props = $props();

  const Component = $derived(wide ? Panel : Card);
</script>

<section class={["frame", className]} aria-label={label} {style}>
  <Component {title} />
</section>
