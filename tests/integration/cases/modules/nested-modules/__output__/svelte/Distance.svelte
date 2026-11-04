<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { formatDistance } from "./format";
  import type { Unit } from "./units";
  import type { ClassValue } from "svelte/elements";

  type Props = { value: number; class?: ClassValue; style?: string };

  let { value, class: className, style, ...attributes }: Props = $props();

  let unit = $state.raw<Unit>("km");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["distance", className]}
  aria-label="Distance"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">{formatDistance(value, unit)}</p
  ><button type="button" onclick={() => (unit = unit === "km" ? "mi" : "km")}>Switch units</button>
</section>
