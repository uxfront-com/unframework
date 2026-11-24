<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLFieldsetAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLFieldsetAttributes,
    "label" | "min" | "max" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    min?: number;
    max?: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["fieldset"] | null;
  };

  let {
    label,
    min = $bindable(0),
    max = $bindable(100),
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  function widen() {
    min -= 10;
    max += 10;
  }
</script>

<fieldset class={className} {style} bind:this={ref} {...attributes}>
  <legend>{label}</legend
  ><p>From {min} to {max}</p
  ><button type="button" onclick={widen}>Widen</button>
</fieldset>
