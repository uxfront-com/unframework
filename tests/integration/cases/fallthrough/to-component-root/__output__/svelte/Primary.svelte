<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style }: Props = $props();
</script>

<Base {text} class={["primary", className]} {style} />
