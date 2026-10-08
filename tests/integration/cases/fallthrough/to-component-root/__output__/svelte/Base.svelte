<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<button type="button" class="base">{text}</button>
