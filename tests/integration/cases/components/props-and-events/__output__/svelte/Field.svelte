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

  let { label, tone = "info", onclear, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["field", tone, className]} {style} {...scopeAttributes(attributes)}>
  <span>{label}</span><button type="button" onclick={() => onclear?.(label)}>Clear {label}</button>
</div>
