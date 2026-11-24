<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SummaryProps {
    name: string;
    plan: string;
    seats: number;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "name" | "plan" | "seats" | "children" | "class" | "style" | "ref"
  > &
    SummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    name,
    plan,
    seats,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div
  class={["summary", className]}
  style={mergeStyle({ display: "table", "border-spacing": "8px 4px" }, style)}
  bind:this={ref}
  {...attributes}
>
  <div style="display: table-caption; font-weight: 700">Account</div
  ><div style="display: table-row">
    <span style="display: table-cell">Name</span><span style="display: table-cell">{name}</span>
  </div
  ><div style="display: table-row">
    <span style="display: table-cell">Plan</span
    ><span style="display: table-cell">{plan} for {seats} seats</span>
  </div
  ><p>Billed to <span style="display: table-cell; padding: 0 4px">{name}</span> monthly.</p>
</div>
