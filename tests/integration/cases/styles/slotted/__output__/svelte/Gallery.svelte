<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<section class={className} {style}>
  <Frame>
    <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
  </Frame
  ><p class="caption">Outside the frame</p>
</section>
