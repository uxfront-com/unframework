<svelte:options runes />

<script lang="ts">
  let { title, subtitle }: { title: string; subtitle?: string } = $props();
</script>

<h2>{title}</h2>{#if subtitle}<p>{subtitle}</p>{/if}
