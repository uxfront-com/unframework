<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Tag from "./Tag.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let active = $state(false);
</script>

<div class={["tags", className]} {style}>
  <Tag label="plain" /><Tag label="wide" class="wide" style="margin-left: 8px"
  /><Tag
    label="toggled"
    class={["picked", { active }]}
    style="color: {active ? "rgb(200, 0, 0)" : undefined}"
  /><button type="button" onclick={() => (active = !active)}>Toggle</button>
</div>
