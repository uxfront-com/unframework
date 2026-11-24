<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FieldProps {
    name: string;
    label: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLLabelAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLLabelAttributes,
    "name" | "label" | "children" | "class" | "style" | "ref"
  > &
    FieldProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["label"] | null;
    };

  let {
    name,
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<label class={className} {style} bind:this={ref} {...attributes}>{label}<input {name} /></label>
