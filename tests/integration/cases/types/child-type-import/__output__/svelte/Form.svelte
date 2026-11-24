<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field, { type FieldProps } from "./Field.svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "field" | "children" | "class" | "style" | "ref"> & {
    field: FieldProps;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { field, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<form aria-label="Sign up" class={className} {style} bind:this={ref} {...attributes}>
  <Field name={field.name} label={field.label} />
</form>
