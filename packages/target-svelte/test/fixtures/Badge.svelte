<svelte:options runes />

<script lang="ts">
  interface BadgeProps {
    label: string;
    tone?: "info" | "warn";
    items?: string[];
    count?: number;
  }

  let { label, tone = "info", items = [], count }: BadgeProps = $props();
</script>

<div><p class={tone} data-count={count}>{label}</p>{#if tone === "warn"}<strong>warning</strong>{/if}<ul>{#each items as item (item)}<li>{item}</li>{/each}</ul></div>
