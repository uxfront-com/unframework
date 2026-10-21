<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Button from "./Button.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<div role="toolbar" aria-label="Actions" class={["toolbar", className]} {style} data-uf-a33d603f="">
  <Button text="Save" data-uf-a33d603f="" /><Button text="Cancel" data-uf-a33d603f="" />
</div>
