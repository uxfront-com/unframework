<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<h3 class="heading">{text}</h3>
