<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type Props = { label: string; ref?: HTMLElementTagNameMap["label"] | null };

  let { label, ref = $bindable(null) }: Props = $props();
</script>

<label class="field" bind:this={ref}>{label} <input name={label.toLowerCase()} /></label>
