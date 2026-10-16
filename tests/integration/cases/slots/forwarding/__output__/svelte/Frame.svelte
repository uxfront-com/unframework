<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Box from "./Box.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    title?: Snippet;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
  };

  let { label, title, children, class: className, style }: Props = $props();
</script>

<section class={["frame", className]} aria-label={label} {style}>
  <Box {children} {title} />
</section>
