<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useControllableState } from "./useControllableState.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "value" | "onchange" | "children" | "class" | "style" | "ref"
  > & {
    value?: number;
    onchange?: (value: number) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    value,
    onchange,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const controllableState = useControllableState(
    () => value,
    1,
    (next) => onchange?.(next),
  );
</script>

<section class={["rating", className]} aria-label="Rating" {style} bind:this={ref} {...attributes}>
  <p role="status">Rated {controllableState.current} of 3</p
  ><button type="button" onclick={() => controllableState.set(2)}>Two</button
  ><button type="button" onclick={() => controllableState.set(3)}>Three</button>
</section>
