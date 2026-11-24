<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Stack.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "gap" | "accent" | "children" | "class" | "style" | "ref"
  > & {
    gap: string;
    accent: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    gap,
    accent,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul
  class={["stack", className]}
  style={mergeStyle({ "--gap": gap, "--accent": accent }, style)}
  data-uf-e3a22111=""
  bind:this={ref}
  {...attributes}
>
  <li class="item" data-uf-e3a22111="">One</li
  ><li class="item" data-uf-e3a22111="">Two</li
  ><li class="item" data-uf-e3a22111="">Three</li>
</ul>
