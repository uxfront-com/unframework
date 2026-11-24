<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { formatDistance } from "./format";
  import type { Unit } from "./units";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "value" | "children" | "class" | "style" | "ref"
  > & {
    value: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { value, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let unit = $state.raw<Unit>("km");
</script>

<section
  class={["distance", className]}
  aria-label="Distance"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">{formatDistance(value, unit)}</p
  ><button type="button" onclick={() => (unit = unit === "km" ? "mi" : "km")}>Switch units</button>
</section>
