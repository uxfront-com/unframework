<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useControllableState } from "./useControllableState.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    value?: number;
    onchange?: (value: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { value, onchange, class: className, style, ...attributes }: Props = $props();

  const controllableState = useControllableState(
    () => value,
    1,
    (next) => onchange?.(next),
  );

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["rating", className]} aria-label="Rating" {style} {...scopeAttributes(attributes)}>
  <p role="status">Rated {controllableState.current} of 3</p
  ><button type="button" onclick={() => controllableState.set(2)}>Two</button
  ><button type="button" onclick={() => controllableState.set(3)}>Three</button>
</section>
