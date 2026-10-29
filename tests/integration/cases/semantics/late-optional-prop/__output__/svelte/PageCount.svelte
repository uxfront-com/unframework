<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PageCountProps {
    page?: number;
    total: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = PageCountProps & {
    onpagechange?: (page: number, previous: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { page = 1, total, onpagechange, class: className, style, ...attributes }: Props = $props();

  const label = $derived(`Page ${page} of ${total}`);

  let previousPage = untrack(() => page);
  $effect.pre(() => {
    const next = page;
    if (Object.is(next, previousPage)) return;
    const previous = previousPage;
    previousPage = next;
    untrack(() => {
      onpagechange?.(next, previous);
    });
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<nav class={["page-count", className]} aria-label="Pages" {style} {...scopeAttributes(attributes)}>
  <p role="status">{label}</p
  ><p>Direct: {page}</p>
</nav>
