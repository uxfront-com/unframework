<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface FieldProps {
    label: string;
    tone?: "info" | "warn";
  }

  type Props = FieldProps & { onclear?: (label: string) => void };

  let { label, tone = "info", onclear }: Props = $props();
</script>

<div class={["field", tone]}>
  <span>{label}</span><button type="button" onclick={() => onclear?.(label)}>Clear {label}</button>
</div>
