<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let picked = $state("none");
</script>

<div class={className} {style}>
  <Avatar imageURL="/a.png" userID={7} onpickedurl={(url) => (picked = url)}
  /><output>Picked: {picked}</output>
</div>
