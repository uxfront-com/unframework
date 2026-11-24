<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    name: string;
  }
</script>

<script lang="ts">
  import { vMark } from "./vMark.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["em"], "name" | "children" | "class" | "style" | "ref"> &
    TagProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["em"] | null };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<em
  class={["tag", className]}
  {@attach vMark(() => `tag ${name}`)}
  {style}
  bind:this={ref}
  {...attributes}
>#{name}</em>
