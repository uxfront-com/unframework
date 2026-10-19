<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<div class={className} {style}>
  <Frame label="Card" wide={false}>
    {#snippet title()}Sunset{/snippet}
  </Frame
  ><Frame label="Panel" wide={true}>
    {#snippet title()}Dawn{/snippet}
  </Frame
  ><Frame label="Empty" wide={true} />
</div>
