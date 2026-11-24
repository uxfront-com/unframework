<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { CountKey } from "./Counter.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue, HTMLOutputAttributes } from "svelte/elements";

  type Props = Omit<HTMLOutputAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["output"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let none = $state(0);
  const count = hasContext(CountKey)
    ? getContext<(typeof CountKey)["__value"]>(CountKey)
    : refObject(() => none);

  function refObject<T>(get: () => T): { readonly value: T } {
    return {
      get value() {
        return get();
      },
    };
  }
</script>

<output class={className} {style} bind:this={ref} {...attributes}>Count: {count.value}</output>
