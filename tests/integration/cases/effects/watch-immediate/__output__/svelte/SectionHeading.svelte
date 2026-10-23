<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface SectionHeadingProps {
    title: string;
  }

  type Props = SectionHeadingProps & {
    onchange?: (title: string, previous?: string) => void;
    onready?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { title, onchange, onready, class: className, style, ...attributes }: Props = $props();

  let previousTitle = untrack(() => title);
  let titleWatched = false;
  $effect.pre(() => {
    const value = title;
    if (titleWatched && Object.is(value, previousTitle)) return;
    const previous = titleWatched ? previousTitle : undefined;
    titleWatched = true;
    previousTitle = value;
    untrack(() => {
      onchange?.(value, previous);
    });
  });

  onMount(() => {
    onready?.();
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<h2 class={["section-heading", className]} {style} {...scopeAttributes(attributes)}>{title}</h2>
