<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    label: string;
    variant?: "neutral" | "danger";
    pressed?: boolean;
    class?: ClassValue;
    style?: string;
  };

  let { label, variant = "neutral", pressed = false, class: className, style }: Props = $props();
</script>

<button
  type="button"
  class={["chip", className]}
  data-variant={variant}
  data-state={pressed ? "on" : "off"}
  aria-pressed={pressed ? "true" : "false"}
  {style}
  data-uf-69db3802=""
>{label}</button>
