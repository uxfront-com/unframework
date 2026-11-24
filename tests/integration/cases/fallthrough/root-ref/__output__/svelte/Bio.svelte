<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { label: string; ref?: HTMLElementTagNameMap["input"] | null };

  let { label, ref = $bindable(null) }: Props = $props();
</script>

<input name="bio" aria-label={label} bind:this={ref} />
