<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import KeepAlive from "./KeepAlive.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { level: number; class?: ClassValue; style?: string };

  let { level, class: className, style }: Props = $props();
</script>

<div class={["level", className]} {style}>
  <span>Level {level}</span
  >{#if level > 0}
    <KeepAlive level={level - 1} />
  {/if}
</div>
