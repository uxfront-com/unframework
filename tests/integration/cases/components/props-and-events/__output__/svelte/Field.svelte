<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface FieldProps {
    label: string;
    tone?: "info" | "warn";
  }

  type Props = FieldProps & {
    onclear?: (label: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { label, tone = "info", onclear, class: className, style }: Props = $props();
</script>

<div class={["field", tone, className]} {style}>
  <span>{label}</span><button type="button" onclick={() => onclear?.(label)}>Clear {label}</button>
</div>
