<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FieldProps {
    label: string;
    tone?: "info" | "warn";
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "label" | "tone" | "onclear" | "children" | "class" | "style" | "ref"
  > &
    FieldProps & {
      onclear?: (label: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    label,
    tone = "info",
    onclear,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["field", tone, className]} {style} bind:this={ref} {...attributes}>
  <span>{label}</span><button type="button" onclick={() => onclear?.(label)}>Clear {label}</button>
</div>
