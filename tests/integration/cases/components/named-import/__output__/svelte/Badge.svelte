<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<span class="badge">{text}</span>
