<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; min?: number; max?: number; class?: ClassValue; style?: string };

  let {
    label,
    min = $bindable(0),
    max = $bindable(100),
    class: className,
    style,
    ...attributes
  }: Props = $props();

  function widen() {
    min -= 10;
    max += 10;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<fieldset class={className} {style} {...scopeAttributes(attributes)}>
  <legend>{label}</legend
  ><p>From {min} to {max}</p
  ><button type="button" onclick={widen}>Widen</button>
</fieldset>
