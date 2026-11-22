<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Field from "./Field.svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<form aria-label="Sign up" class={className} {style} bind:this={ref} {...attributes}>
  <Field label="Email" /><Field label="Name" />
</form>
