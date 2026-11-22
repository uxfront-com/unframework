<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "name" | "done" | "children" | "class" | "style" | "ref"
  > & {
    name: string;
    done: boolean;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    name,
    done,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div
  role="listitem"
  class={["row", { done }, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{name}{done ? " (done)" : ""}</div>
