<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Labelled } from "./types";
  import type { TimeInterval } from "rxjs";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type StatusProps = TimeInterval<string> & Labelled;

  type Props = Omit<
    SvelteHTMLElements["p"],
    "value" | "interval" | "label" | "children" | "class" | "style" | "ref"
  > &
    StatusProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["p"] | null };

  let {
    value,
    interval,
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{label}: {value} after {interval} ms</p>
