<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTeardown } from "./useTeardown.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "name" | "onclosed" | "children" | "class" | "style" | "ref"
  > & {
    name: string;
    onclosed?: (entry: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    name,
    onclosed,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const teardown = useTeardown(
    () => name,
    (entry) => onclosed?.(entry),
  );
</script>

<section
  class={["panel", className]}
  aria-label={teardown.title}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{teardown.title}</h2>
</section>
