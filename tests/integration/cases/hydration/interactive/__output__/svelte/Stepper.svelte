<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StepperProps {
    start?: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "start" | "onchange" | "children" | "class" | "style" | "ref"
  > &
    StepperProps & {
      onchange?: (value: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    start = 0,
    onchange,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let count = $state(untrack(() => start));

  function add() {
    count += 1;
    onchange?.(count);
  }
</script>

<div class={["stepper", className]} {style} bind:this={ref} {...attributes}>
  <output>{count}</output><button type="button" onclick={add}>Add one</button>
</div>
