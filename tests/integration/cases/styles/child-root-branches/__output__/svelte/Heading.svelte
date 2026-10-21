<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { big, text }: { big: boolean; text: string } = $props();
</script>

<svelte:element this={big ? "h2" : "h3"} class="heading">{text}</svelte:element>
