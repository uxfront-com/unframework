<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<span class="pill">{text}</span>
